import { z } from 'zod';
import ts from 'typescript';
import { KitError, type Registry, type RequestEnvelope } from '../contracts/index.js';
import { ProjectRegistry } from '../projects/registry.js';
import { SnapshotStore } from '../snapshots/store.js';
import { Formatter } from '../query/formatter.js';
import { GraphDocument, fingerprint } from '../graph/decode.js';
import { readDocument } from '../daemon/read-document.js';
import { captureSources } from './roots.js';
import { SourceIndex } from './typescript-index.js';
import { assertFresh } from './invalidation.js';
import { references, dynamicEdges } from './references.js';
import { sliceSource, sourceFile } from './slices.js';
import { sourceMapping } from './source-maps.js';
import { eventBindings } from './bindings.js';
import { AssetIndex } from '../assets/index.js';
import { location } from './locations.js';
const base = z.object({ snapshot: z.string() }).strict(), target = base.extend({ type: z.string().min(1).max(256) }), paged = base.extend({ limit: z.number().int().min(1).max(50).optional(), cursor: z.string().optional() });
export function registerSource(registry: Registry, projects: ProjectRegistry, snapshots: SnapshotStore, formatter: Formatter) {
    const id = (r: RequestEnvelope) => {
        if (!r.projectId)
            throw new KitError('SCHEMA_MISMATCH', 'projectId required');
        return r.projectId;
    };
    const add = (name: string, inputSchema: z.ZodType, handler: any) => registry.register({ name, area: 'source', process: 'offline', readOnly: true, availability: 'available', inputSchema, handler });
    const index = async (snapshot: string, r: RequestEnvelope) => {
        const value = snapshots.resource(snapshot, { projectId: id(r), source: 'disk' });
        if (!(value instanceof SourceIndex))
            throw new KitError('SCHEMA_MISMATCH', 'Snapshot is not a source index');
        await assertFresh(value.capture);
        return value;
    };
    const graph = async (snapshot: string, r: RequestEnvelope) => {
        const value = snapshots.resource(snapshot, { projectId: id(r), source: 'disk' });
        if (!(value instanceof GraphDocument))
            throw new KitError('SCHEMA_MISMATCH', 'Snapshot is not a disk UI graph');
        const file = await projects.resolve(id(r), value.view.context.document.replace(/^db:\/\//, ''));
        if (fingerprint((await readDocument(file)).toString()) !== value.view.revision)
            throw new KitError('STALE_REVISION', 'Serialized bindings changed; recapture graph');
        for (const [file, hash] of Object.entries(value.dependencies()))
            if (fingerprint((await readDocument(file)).toString()) !== hash)
                throw new KitError('STALE_REVISION', 'Graph asset metadata/source changed');
        const current = await AssetIndex.scan((await projects.get(id(r))).root);
        if (current.inventoryRevision !== value.inventoryRevision)
            throw new KitError('STALE_REVISION', 'Graph asset inventory changed; recapture graph');
        return value;
    };
    add('source.capture', z.object({ packages: z.array(z.string()).max(8).optional(), engineRoot: z.string().optional(), enginePaths: z.array(z.string()).min(1).max(16).optional() }).strict(), async (p: any, r: RequestEnvelope) => { const project = await projects.get(id(r)); const packageFile = await projects.resolve(project.id, 'package.json'); const creatorVersion = JSON.parse((await readDocument(packageFile)).toString()).creator?.version; if (typeof creatorVersion !== 'string')
        throw new KitError('UNAVAILABLE_CAPABILITY', 'Project has no current Creator version'); const capture = await captureSources(project.root, { ...p, creatorVersion }); const sourceIndex = new SourceIndex(capture); await assertFresh(capture); const summary = sourceIndex.list(); const snapshot = snapshots.capture({ projectId: project.id, source: 'disk', session: null, document: 'source-index', revision: { data: capture.revision, schema: 'source-navigator-v1', engine: capture.engine, assets: 'captured-source-meta', sourceIndex: capture.revision }, data: summary, warnings: sourceIndex.warnings }, { resource: sourceIndex, bytes: capture.bytes * 12 }); return { snapshot: snapshot.id, revision: capture.revision, classes: summary.length, files: capture.files.size, engine: capture.engine, coverage: { mode: 'static-compiler', execute: false, write: false, completeCallGraph: false } }; });
    add('source.classes', paged, async (p: any, r: RequestEnvelope) => { const value = await index(p.snapshot, r); return formatter.page({ ...p, projectId: id(r) }, { key: 'source.classes', items: value.list() }); });
    add('component.source', base.extend({ type: z.string().optional(), graphSnapshot: z.string().optional(), target: z.string().optional() }).refine(p => (!p.graphSnapshot && !p.target && !!p.type) || !!p.graphSnapshot && !!p.target, { message: 'type or graphSnapshot/target required' }), async (p: any, r: RequestEnvelope) => {
        const value = await index(p.snapshot, r);
        let type = p.type;
        if (p.graphSnapshot) {
            const document = await graph(p.graphSnapshot, r), component = document.resolve(p.target);
            if (component.kind !== 'component')
                throw new KitError('SCHEMA_MISMATCH', 'Select a component, not a node');
            if (type && type !== component.type)
                throw new KitError('SCHEMA_MISMATCH', 'Declared type differs from selected component');
            type = component.type;
        }
        return value.resolve(type);
    });
    add('symbol.definition', target.extend({ member: z.string().optional() }), async (p: any, r: RequestEnvelope) => { const value = await index(p.snapshot, r), item = value.resolve(p.type); return p.member ? value.method(item.id, p.member) : item; });
    add('type.hierarchy', target.extend({ limit: z.number().int().min(1).max(50).optional(), cursor: z.string().optional() }), async (p: any, r: RequestEnvelope) => { const value = await index(p.snapshot, r), item = value.resolve(p.type); return formatter.page({ ...p, projectId: id(r) }, { key: JSON.stringify(['hierarchy', item.id]), items: value.hierarchy(item.id) }); });
    add('symbol.references', target.extend({ member: z.string().optional(), limit: z.number().int().min(1).max(50).optional(), cursor: z.string().optional() }), async (p: any, r: RequestEnvelope) => { const value = await index(p.snapshot, r), item = value.resolve(p.type); return formatter.page({ ...p, projectId: id(r) }, { key: JSON.stringify(['references', item.id, p.member]), items: references(value, item.id, p.member) }); });
    add('source.dynamic', paged, async (p: any, r: RequestEnvelope) => { const value = await index(p.snapshot, r); return formatter.page({ ...p, projectId: id(r) }, { key: 'dynamic', items: dynamicEdges(value) }); });
    add('method.body', target.extend({ member: z.string().min(1), offset: z.number().int().nonnegative().default(0) }), async (p: any, r: RequestEnvelope) => {
        const value = await index(p.snapshot, r), item = value.resolve(p.type), method = value.method(item.id, p.member);
        if (!method.body)
            return { ...method, text: null, nextOffset: null };
        return { ...method, ...sliceSource(value.capture, method.location.uri, method.location.hash, { start: method.location.range.start.offset, end: method.location.range.end.offset, offset: p.offset }), mapping: sourceMapping(value.capture, method.location.path, method.location.range.start.line, method.location.range.start.column) };
    });
    add('source.slice', base.extend({ uri: z.string(), hash: z.string(), start: z.number().int().nonnegative().optional(), end: z.number().int().nonnegative().optional(), offset: z.number().int().nonnegative().default(0) }), async (p: any, r: RequestEnvelope) => sliceSource((await index(p.snapshot, r)).capture, p.uri, p.hash, p));
    add('source.mapping', base.extend({ uri: z.string(), line: z.number().int().positive(), column: z.number().int().positive() }), async (p: any, r: RequestEnvelope) => { const value = await index(p.snapshot, r), file = sourceFile(value.capture, p.uri); return sourceMapping(value.capture, file.path, p.line, p.column); });
    add('event.bindings', paged.extend({ graphSnapshot: z.string() }), async (p: any, r: RequestEnvelope) => { const value = await index(p.snapshot, r), document = await graph(p.graphSnapshot, r); return formatter.page({ ...p, projectId: id(r) }, { key: JSON.stringify(['bindings', p.graphSnapshot]), items: eventBindings(value, document) }); });
    add('source.dependencies', target, async (p: any, r: RequestEnvelope) => {
        const value = await index(p.snapshot, r), item = value.item(value.resolve(p.type).id), source = item.node.getSourceFile(), result: any[] = [];
        for (const statement of source.statements) {
            if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier) {
                const symbol = value.canonical(value.checker.getSymbolAtLocation(statement.moduleSpecifier)), declaration = symbol?.declarations?.find(ts.isSourceFile);
                result.push({ specifier: statement.moduleSpecifier.getText(source), status: declaration && value.capture.files.has(declaration.fileName) ? 'resolved' : 'unresolved', location: location(value.capture, statement), target: declaration && value.capture.files.has(declaration.fileName) ? location(value.capture, declaration) : null });
            }
        }
        return { sourceIndexRevision: value.capture.revision, dependencies: result, complete: false };
    });
}
