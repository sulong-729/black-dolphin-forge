import {RuntimeSessions} from '../runtime/client.js';
import {registerRuntime,runtimeControls} from '../runtime/service.js';
import {registerMutations} from '../mutation/apply.js';
import {mutationControls} from '../mutation/propose.js';
import { z } from 'zod';
import { readDocument } from './read-document.js';
import { createHash } from 'node:crypto';
import { Registry, KitError, createRequest, validateEnvelope, errorInfo, type RequestEnvelope } from '../contracts/index.js';
import { ProjectRegistry } from '../projects/registry.js';
import { SnapshotStore } from '../snapshots/store.js';
import { Formatter } from '../query/formatter.js';
import {EditorSessions} from '../editor/session.js';
import {registerEditor,bridgeControls} from '../editor/transport.js';
import {registerSource} from '../source/service.js';
import {registerGraphs} from '../graph/service.js';
const empty = z.object({}).strict();
export function createDispatcher(state: string, identity: {
    instanceId: string;
    pid: number;
}, stop: () => void) {
    const projects = new ProjectRegistry(state);
    const runtime = new RuntimeSessions(id=>snapshots.expireSession(id,'runtime'));
    const sessions = new EditorSessions({invalidate:id=>snapshots.expireSession(id)});
    const snapshots = new SnapshotStore({validate:snapshot=>{if(snapshot.source==='runtime'&&snapshot.session){try{runtime.select(snapshot.projectId,snapshot.session);}catch{snapshots.expire(snapshot.id);}}if(snapshot.source==='editor'&&snapshot.session){try{sessions.select(snapshot.projectId,snapshot.session);}catch{snapshots.expire(snapshot.id);}}}}), formatter = new Formatter(snapshots);
    // This local registration permission cannot authorize asset/source/engine writes.
    const registry = new Registry(cap => cap.name === 'project.register' || bridgeControls.has(cap.name) || mutationControls.has(cap.name) || runtimeControls.has(cap.name));
    const add = (name: string, inputSchema: z.ZodType, handler: NonNullable<Parameters<Registry['register']>[0]['handler']>, readOnly = true) => registry.register({ name, area: name.split('.')[0], process: 'offline', readOnly, availability: 'available', inputSchema, handler });
    const projectId = (r: RequestEnvelope) => { if (!r.projectId)
        throw new KitError('SCHEMA_MISMATCH', 'projectId is required'); return r.projectId; };
    add('capabilities.describe', z.object({ operation: z.string().optional() }).strict(), p => registry.describe(p.operation));
    add('project.register', z.object({ root: z.string().min(1) }).strict(), p => projects.register(p.root), false);
    add('project.list', empty, () => projects.list());
    add('project.inspect', empty, (_, r) => projects.get(projectId(r)));
    add('document.capture', z.object({ path: z.string().min(1) }).strict(), async (p, r) => { const id = projectId(r), file = await projects.resolve(id, p.path); const bytes = await readDocument(file); let data; try {
        data = JSON.parse(bytes.toString('utf8'));
    }
    catch {
        throw new KitError('SCHEMA_MISMATCH', 'Document must contain JSON');
    } const revision = { data: createHash('sha256').update(bytes).digest('hex'), schema: 'raw-json-v1', engine: 'unqualified', assets: 'not-indexed', sourceIndex: 'not-indexed' }; const snap = snapshots.capture({ projectId: id, source: 'disk', document: p.path, session: null, revision, data, warnings: ['Raw JSON foundation only; not a Cocos-qualified UI graph or Editor snapshot.'] }); return { snapshot: snap.id, revision, source: 'disk', coverage: 'raw-json-only' }; });
    const q = z.object({ snapshot: z.string(), mode: z.enum(['records', 'tree']).optional(), source: z.enum(['disk', 'editor', 'runtime']).optional(), session: z.string().nullable().optional(), limit: z.number().int().min(1).max(50).optional(), depth: z.number().int().min(0).max(32).optional(), cursor: z.string().optional() }).strict();
    add('snapshot.query', q, (p, r) => formatter.page({ ...p, projectId: projectId(r) }));
    add('snapshot.batch', z.object({ queries: z.array(q).max(50) }).strict(), (p, r) => formatter.batch(p.queries.map((x: any) => ({ ...x, projectId: projectId(r) }))));
    add('artifact.read', z.object({ snapshot: z.string(), kind: z.enum(['data', 'warnings']), offset: z.number().int().nonnegative().default(0) }).strict(), (p, r) => { const snap = snapshots.get(p.snapshot, { projectId: projectId(r) }); const text = JSON.stringify(p.kind === 'data' ? snap.data : snap.warnings); if (p.offset > text.length)
        throw new KitError('SCHEMA_MISMATCH', 'Offset outside artifact'); return { text: text.slice(p.offset, p.offset + 6000), offset: p.offset, nextOffset: p.offset + 6000 < text.length ? p.offset + 6000 : null, total: text.length }; });
    add('daemon.status', empty, () => ({ service: 'cocos-ai-toolkit', ...identity }));
    add('daemon.stop', empty, () => { stop(); return { stopping: true, ...identity }; });
    for (const name of ['job.start'])
        registry.register({ name, area: name.split('.')[0], process: name.startsWith('job') ? 'build-worker' : 'editor-main', readOnly: name === 'editor.query', availability: name.startsWith('job') ? 'unavailable' : 'requires-editor', inputSchema: empty });
    registerGraphs(registry,projects,snapshots,formatter);
    registerSource(registry,projects,snapshots,formatter);
    registerEditor(registry,projects,snapshots,sessions);
    registerMutations(registry,sessions,state,identity.instanceId);
    registerRuntime(registry,projects,snapshots,formatter,runtime);
    async function facade(name: string, input: any) {
        const raw = input && Object.hasOwn(input,'request') ? input.request : createRequest('capabilities.describe', input?.operation ? {operation:input.operation} : {});
        let request: RequestEnvelope;
        try { request = validateEnvelope(raw); } catch { return registry.dispatch(raw); }
        const fail = (error: KitError) => ({formatVersion:1 as const, requestId:request.requestId, status:'error' as const, warnings:[], error:errorInfo(error)});
        if (!['cocos_describe','cocos_query','cocos_artifact','cocos_propose','cocos_apply'].includes(name))
            return fail(new KitError('UNAVAILABLE_CAPABILITY','Facade unavailable for this operation in Phase 1','Inspect capabilities; editor/job adapters are not qualified.'));
        if (name === 'cocos_describe' && request.operation !== 'capabilities.describe' || name === 'cocos_artifact' && request.operation !== 'artifact.read')
            return fail(new KitError('UNAVAILABLE_CAPABILITY','Operation does not belong to this facade'));
        if (name === 'cocos_propose' && !['editor.propose','editor.rollback.propose'].includes(request.operation) || name === 'cocos_apply' && request.operation !== 'editor.apply')
            return fail(new KitError('UNAVAILABLE_CAPABILITY','Operation does not belong to this facade'));
        if (name === 'cocos_query') {
            const cap = registry.describe().find(c => c.name === request.operation);
            // Unknown/malformed/unavailable reads keep the dispatcher's original error envelope.
            if (cap && (!cap.readOnly || ['daemon.stop','editor.propose','editor.rollback.propose'].includes(request.operation)))
                return fail(new KitError('AUTHORIZATION_REQUIRED','Query facade accepts reads only','Use an authorized lifecycle/configuration command.'));
        }
        return registry.dispatch(request);
    }
    return { registry, dispatch: (request: unknown) => registry.dispatch(request), facade, projects, snapshots, sessions, runtime };
}
