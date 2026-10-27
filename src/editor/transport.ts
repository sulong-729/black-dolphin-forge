import {assertCurrentVersion} from '../compatibility/current.js';
import { z } from 'zod';
import { Registry, KitError, type RequestEnvelope } from '../contracts/index.js';
import { ProjectRegistry } from '../projects/registry.js';
import { SnapshotStore } from '../snapshots/store.js';
import { EditorSessions } from './session.js';
import { schemaHash } from '../schema/registry.js';
const state = z.object({ document: z.string().max(4096), stage: z.enum(['scene', 'prefab', 'none']), revision: z.string().min(1).max(128), schema: z.string().min(1).max(128), importing: z.boolean(), dirty: z.boolean() }).strict();
const lease = z.object({ session: z.string().uuid(), lease: z.string().length(64) }).strict();
export const bridgeControls = new Set(['editor.connect', 'editor.heartbeat', 'editor.poll', 'editor.respond', 'editor.disconnect']);
export function registerEditor(registry: Registry, projects: ProjectRegistry, snapshots: SnapshotStore, sessions: EditorSessions) {
    const project = (r: RequestEnvelope) => {
        if (!r.projectId)
            throw new KitError('SCHEMA_MISMATCH', 'projectId required');
        return r.projectId;
    };
    const control = (name: string, inputSchema: z.ZodType, handler: any) => registry.register({ name, area: 'editor', process: 'offline', readOnly: false, availability: 'available', inputSchema, handler });
    const auth = (p: any, r: RequestEnvelope) => { sessions.select(project(r), p.session); };
    control('editor.connect', z.object({ root: z.string(), creatorVersion: z.string().max(32), engineVersion: z.string().max(32), instance: z.string().min(1).max(128), features: z.record(z.string(), z.boolean()), state }).strict(), async (p: any, r: RequestEnvelope) => {
        const registered = await projects.get(project(r));
        const { realpath } = await import('node:fs/promises');
        if (await realpath(p.root) !== registered.root)
            throw new KitError('FOREIGN_PROJECT', 'Editor root differs from registered project');
        if(registered.creatorVersion && registered.creatorVersion!==p.creatorVersion)throw new KitError('CONFLICT','Editor version differs from project metadata; open the matching Creator version');
        return sessions.connect({ projectId: registered.id, ...p });
    });
    control('editor.heartbeat', lease.extend({ state }), (p: any, r: RequestEnvelope) => { auth(p, r); return sessions.heartbeat(p.session, p.lease, p.state); });
    control('editor.poll', lease, (p: any, r: RequestEnvelope) => { auth(p, r); return sessions.poll(p.session, p.lease); });
    control('editor.respond', lease.extend({ response: z.object({ id: z.string().uuid(), revision: z.string().max(128), data: z.unknown().optional(), error: z.string().max(500).optional() }).strict() }), (p: any, r: RequestEnvelope) => { auth(p, r); return sessions.respond(p.session, p.lease, p.response); });
    control('editor.disconnect', lease, (p: any, r: RequestEnvelope) => { auth(p, r); return sessions.disconnect(p.session, p.lease); });
    registry.register({ name: 'editor.sessions', area: 'editor', process: 'offline', readOnly: true, availability: 'available', inputSchema: z.object({}).strict(), handler: (_, r) => sessions.list(project(r)) });
    registry.register({ name: 'editor.query', area: 'editor', process: 'editor-scene', readOnly: true, availability: 'available', inputSchema: z.discriminatedUnion('command', [
            z.object({ command: z.literal('scene.capture') }).strict(),
            z.object({ command: z.literal('schema.list'), offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(50).default(25), schema: z.string().optional() }).strict(),
            z.object({ command: z.literal('schema.describe'), type: z.string().min(1).max(256), schema: z.string() }).strict(),
        ]), handler: async (p, r) => {
            const id = project(r), selected = sessions.select(id, r.session);
            await assertCurrentVersion(projects,id,selected.creatorVersion);
            if (r.revision && r.revision !== selected.state.revision)
                throw new KitError('STALE_REVISION', 'Expected Editor revision differs');
            const data = await sessions.request(id, selected.session, p.command, p) as any;
            await assertCurrentVersion(projects,id,selected.creatorVersion);
            const current = sessions.select(id, selected.session);
            if (current.state.revision !== selected.state.revision || current.state.schema !== selected.state.schema)
                throw new KitError('STALE_REVISION', 'Editor changed before capture commit');
            const revision = { data: current.state.revision, schema: current.state.schema, engine: current.engineVersion, assets: 'editor-observed', sourceIndex: 'not-indexed' };
            const snap = snapshots.capture({ projectId: id, source: 'editor', document: current.state.document, session: current.session, revision, data, warnings: ['Read-only owner-process observation; no writable/roundtrip qualification.'] });
            return { snapshot: snap.id, source: 'editor', session: current.session, state: current.state, revision, contentHash: schemaHash(data), coverage: { write: false, roundtrip: false } };
        } });
}
