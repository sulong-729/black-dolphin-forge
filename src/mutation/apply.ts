import { z } from 'zod';
import { Registry, KitError, type RequestEnvelope } from '../contracts/index.js';
import { EditorSessions } from '../editor/session.js';
import { MutationPolicy, type Proposal } from './policy.js';
import { MutationLocks } from './idempotency.js';
import { proposalSchema, applySchema } from './propose.js';
export function registerMutations(registry: Registry, sessions: EditorSessions, state: string, instance: string) {
    const policy = new MutationPolicy(state, instance), locks = new MutationLocks();
    const scope = (p: Proposal, r: RequestEnvelope) => { if (p.projectId !== r.projectId)
        throw new KitError('FOREIGN_PROJECT', 'Proposal project differs'); if (p.session !== r.session)
        throw new KitError('PROCESS_MISMATCH', 'Proposal requires exact Editor session'); };
    const owner = (r: RequestEnvelope) => { if (!r.projectId || !r.session)
        throw new KitError('SCHEMA_MISMATCH', 'Explicit project and session required'); const s = sessions.select(r.projectId, r.session); if (!s.features.mutationV1)
        throw new KitError('UNAVAILABLE_CAPABILITY', 'Owner mutation adapter is unavailable'); if (!r.revision || r.revision !== s.state.revision)
        throw new KitError('STALE_REVISION', 'Explicit current Editor revision required'); if (s.state.importing || s.state.stage !== 'scene')
        throw new KitError('UNSUPPORTED_OPERATION', 'Only ready plain-scene instance writes are qualified'); return s; };
    const add = (name: string, inputSchema: z.ZodType, handler: any, readOnly = true) => registry.register({ name, area: 'editor', process: 'editor-scene', readOnly, availability: 'available', inputSchema, handler, ...(name === 'editor.apply' ? { resultStatus: (data: any) => ['partial', 'indeterminate'].includes(data?.status) ? data.status : 'ok' as const } : {}) });
    const prepare = async (command: string, p: any, r: RequestEnvelope) => { const selected = owner(r); if (Buffer.byteLength(JSON.stringify(p)) > 4000)
        throw new KitError('RESOURCE_LIMIT', 'Proposal exceeds compact preview budget; split steps'); const prepared = await sessions.requestMutation(r.projectId!, r.session!, command, p) as any; if (!prepared?.ownerPlan || !Array.isArray(prepared.preview))
        throw new KitError('INTEGRITY_ERROR', 'Owner returned invalid proposal'); const now = sessions.select(r.projectId!, r.session!); if (now.state.revision !== selected.state.revision || now.state.schema !== selected.state.schema)
        throw new KitError('STALE_REVISION', 'Owner changed during proposal'); const proposal = await policy.create({ projectId: r.projectId!, session: r.session!, document: selected.state.document, revision: r.revision!, schema: selected.state.schema, ownerPlan: prepared.ownerPlan, preview: prepared.preview }); return { ...proposal, ownerPlan: undefined, save: false, scope: 'scene-instance', approval: 'local-cli-exact-hash', evidence: 'editor-owner-preflight' }; };
    add('editor.propose', proposalSchema, (p: any, r: RequestEnvelope) => prepare('mutation.prepare', p, r));
    add('editor.rollback.propose', z.object({ checkpoint: z.string().uuid() }).strict(), (p: any, r: RequestEnvelope) => prepare('mutation.rollback.prepare', p, r));
    add('editor.mutation.status', z.object({ proposal: z.string().uuid() }).strict(), async (p: any, r: RequestEnvelope) => { const journal = await policy.read(p.proposal); scope(journal.proposal, r); return { proposal: p.proposal, status: journal.attempt?.status ?? 'proposed', result: journal.attempt?.result ?? (journal.attempt ? { status: 'indeterminate', recovery: 'Do not replay; inspect owner state and reconcile.' } : null) }; });
    add('editor.apply', applySchema, async (p: any, r: RequestEnvelope) => locks.run(p.proposal, async () => { const journal = await policy.read(p.proposal), proposal = journal.proposal; scope(proposal, r); if (journal.attempt) {
        if (journal.attempt.key !== p.idempotencyKey)
            throw new KitError('CONFLICT', 'Proposal already attempted with a different idempotency key');
        return journal.attempt.result ?? { status: 'indeterminate', recovery: 'Attempt was dispatched; never replay blindly.' };
    } await policy.authorize(proposal); const selected = owner({ ...r, revision: proposal.revision }); if (selected.state.document !== proposal.document || selected.state.schema !== proposal.schema)
        throw new KitError('STALE_REVISION', 'Proposal document/schema differs'); journal.attempt = { key: p.idempotencyKey, status: 'pending' }; await policy.write(journal); let result; try {
        result = await sessions.requestMutation(r.projectId!, r.session!, 'mutation.apply', { ownerPlan: proposal.ownerPlan, operationId: proposal.id, hash: proposal.hash });
    }
    catch {
        result = { status: 'indeterminate', recovery: 'Owner acknowledgment unavailable; inspect live state. This proposal cannot execute again.' };
    } journal.attempt = { key: p.idempotencyKey, status: 'done', result }; await policy.write(journal); return result; }), false);
}
