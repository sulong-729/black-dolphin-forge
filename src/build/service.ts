import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { Registry, KitError, type RequestEnvelope } from '../contracts/index.js';
import { ProjectRegistry } from '../projects/registry.js';
import { MutationPolicy, digest } from '../mutation/policy.js';
import { MutationLocks } from '../mutation/idempotency.js';
import { JobRunner } from '../jobs/runner.js';
import { loadProfile } from './profiles.js';
import { fingerprint, fileHash } from './fingerprints.js';
import { artifactManifest } from './artifacts.js';
import { analyze } from '../diagnostics/console.js';
import { sourceDiagnostic } from '../diagnostics/stacks.js';
export const jobControls = new Set(['job.start', 'job.cancel']);
export function registerBuild(registry: Registry, projects: ProjectRegistry, state: string, instance: string) {
    const runner = new JobRunner(path.join(state, 'jobs')), policy = new MutationPolicy(state, instance), locks = new MutationLocks();
    const projectId = (r: RequestEnvelope) => { if (!r.projectId)
        throw new KitError('SCHEMA_MISMATCH', 'projectId required'); return r.projectId; };
    const add = (name: string, schema: z.ZodType, handler: any, readOnly = true) => registry.register({ name, area: name.split('.')[0], process: 'build-worker', readOnly, availability: 'available', inputSchema: schema, handler, ...(name === 'job.start' ? { resultStatus: (data: any) => data?.status === 'indeterminate' ? 'indeterminate' as const : 'ok' as const } : {}) });
    const empty = z.object({}).strict(), job = z.object({ job: z.string().uuid() }).strict();
    async function inputs(id: string) { const project = await projects.get(id), profile = await loadProfile(state, id), source = await fingerprint(project.root); if (project.creatorVersion !== '3.7.3')
        throw new KitError('UNAVAILABLE_CAPABILITY', 'Only Creator3.7.3 profile is qualified'); const creatorHash = await fileHash(profile.creator), pythonHash = await fileHash(profile.python), engine = await fingerprint(profile.engineRoot, { maxBytes: 4 * 1024 * 1024 * 1024, maxFiles: 100000, excludePaths: ['bin/.cache'] }), workerHash = await fileHash(fileURLToPath(new URL('../../adapters/python/protocol.py', import.meta.url))); return { project, profile, source, creatorHash, pythonHash, engine, workerHash, hash: digest({ profile, source, creatorHash, pythonHash, engine, workerHash }) }; }
    add('build.doctor', empty, async (_: any, r: RequestEnvelope) => { await projects.get(projectId(r)); try {
        const v = await inputs(r.projectId!);
        return { available: true, profile: v.profile, source: v.source, reasons: [], note: 'Configured executable/content check; SDK/native device execution not qualified' };
    }
    catch (e) {
        return { available: false, reasons: [e instanceof KitError ? e.message : 'Cannot read configured tools/inputs'], recovery: 'Use build configure with absolute Creator3.7.3 and Python3 executables; no automatic install' };
    } });
    add('build.propose', empty, async (_: any, r: RequestEnvelope) => { const v = await inputs(projectId(r)); const proposal = await policy.create({ projectId: r.projectId!, session: 'build', document: 'build-profile', revision: v.hash, schema: 'build-profile-v1', ownerPlan: JSON.stringify({ kind: 'build.web-mobile', inputs: v }), preview: { target: 'web-mobile', scene: v.profile.scene, debug: v.profile.debug, source: v.source, creator: v.profile.creator, python: v.profile.python, engine: {root:v.profile.engineRoot,...v.engine}, output: 'private job directory (unique)', sideEffects: ['Creator import/cache writes in project library/temp/settings', 'Generated output in private job directory', 'Project hooks/extensions may execute as part of Creator build'], stages: ['doctor', 'validate', 'export', 'artifact'], cache: 'not-reused', rollback: 'Output isolated; Creator import/cache changes are not transactional' } }); return { ...proposal, ownerPlan: undefined, approval: 'local-cli-exact-hash' }; });
    add('job.start', z.object({ proposal: z.string().uuid(), idempotencyKey: z.string().min(1).max(128) }).strict(), async (p: any, r: RequestEnvelope) => locks.run(p.proposal, async () => {
        const record = await policy.read(p.proposal), proposal = record.proposal;
        if (proposal.projectId !== projectId(r))
            throw new KitError('FOREIGN_PROJECT', 'Proposal project differs');
        if (proposal.session !== 'build' || proposal.schema !== 'build-profile-v1')
            throw new KitError('PROCESS_MISMATCH', 'Not a build proposal');
        if (record.attempt) {
            if (record.attempt.key !== p.idempotencyKey)
                throw new KitError('CONFLICT', 'Proposal already attempted');
            return record.attempt.result ?? { status: 'indeterminate', recovery: 'Reconcile persisted jobs; do not replay.' };
        }
        await policy.authorize(proposal);
        const current = await inputs(r.projectId!);
        if (current.hash !== proposal.revision)
            throw new KitError('STALE_REVISION', 'Build inputs/profile/executable changed; propose again');
        record.attempt = { key: p.idempotencyKey, status: 'pending' };
        await policy.write(record);
        const script = fileURLToPath(new URL('../../adapters/python/protocol.py', import.meta.url));
        const taskParams = { project: current.project.root, creator: current.profile.creator, engineRoot: current.profile.engineRoot, scene: current.profile.scene, debug: current.profile.debug };
        // Job output is chosen by the runner id, never by the client/profile.
        let result;
        try {
            const started = await runner.start({ projectId: r.projectId!, key: proposal.id + ':' + p.idempotencyKey, requestHash: proposal.hash, steps: [{ name: 'doctor', executable: current.profile.python, args: [script], task: 'doctor', params: taskParams, cwd: current.project.root, timeoutMs: 10000 }, { name: 'validate', executable: current.profile.python, args: [script], task: 'validate', params: taskParams, cwd: current.project.root, timeoutMs: 10000 }, { name: 'export', executable: current.profile.python, args: [script], task: 'export', params: (record: any) => ({ ...taskParams, output: path.join(runner.directory, record.id, 'output'), sceneUrl: 'db://' + record.stages.find((s: any) => s.name === 'validate').data.scenePath.replace(/\\/g, '/').replace(/\.meta$/, '') }), cwd: current.project.root, timeoutMs: current.profile.timeoutMs }], finalize: async (jobRecord) => {
                    const dir = path.join(runner.directory, jobRecord.id), after = await inputs(r.projectId!), manifest = await artifactManifest(path.join(dir, 'output'), current.hash, after.hash);
                    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ ...manifest, job: jobRecord.id, profile: current.profile, engine: current.creatorHash }), { mode: 0o600 });
                    if (manifest.stale)
                        throw new KitError('STALE_REVISION', 'Build inputs changed; artifact marked stale');
                    return { artifact: 'manifest', files: manifest.files.length, stale: false, launch: 'NOT_RUN', visual: 'NOT_RUN', device: 'NOT_RUN' };
                } });
            result = { job: started.id, status: started.status };
        }
        catch (e) {
            if (e instanceof KitError && ['CONFLICT', 'RESOURCE_LIMIT', 'UNAVAILABLE_CAPABILITY', 'INTEGRITY_ERROR'].includes(e.code)) {
                delete record.attempt;
                await policy.write(record);
                throw e;
            }
            result = { status: 'indeterminate', recovery: 'Inspect persisted jobs before retry', error: e instanceof KitError ? e.code : 'INTERNAL_ERROR' };
        }
        record.attempt = { key: p.idempotencyKey, status: 'done', result };
        await policy.write(record);
        return result;
    }), false);
    add('job.status', job, async (p: any, r: RequestEnvelope) => runner.status(projectId(r), p.job));
    add('job.cancel', job, async (p: any, r: RequestEnvelope) => runner.cancel(projectId(r), p.job), false);
    add('job.artifact.read', job.extend({ kind: z.enum(['log', 'manifest']).default('log'), offset: z.number().int().min(0).default(0) }), async (p: any, r: RequestEnvelope) => { const jobStatus = (await runner.status(projectId(r), p.job)).status; let text; try {
        text = await readFile(path.join(runner.directory, p.job, p.kind === 'log' ? 'log.txt' : 'manifest.json'), 'utf8');
    }
    catch {
        throw new KitError('NOT_FOUND', 'Artifact not available');
    } if (p.offset > text.length)
        throw new KitError('SCHEMA_MISMATCH', 'Artifact offset outside range'); return { jobStatus, releaseReady: false, text: text.slice(p.offset, p.offset + 6000), offset: p.offset, nextOffset: p.offset + 6000 < text.length ? p.offset + 6000 : null, total: text.length }; });
    add('diagnostics.source', z.object({ path: z.string().min(1).max(4096), line: z.number().int().min(1), column: z.number().int().min(1), hash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict(), async (p: any, r: RequestEnvelope) => sourceDiagnostic(await projects.resolve(projectId(r), p.path), p));
    add('diagnostics.analyze', z.object({ text: z.string().max(65536) }).strict(), (p: any) => analyze(p.text));
    for (const name of ['android.install', 'android.launch', 'ios.install', 'ios.launch', 'diagnostics.profiler'])
        registry.register({ name, area: name.split('.')[0], process: 'build-worker', readOnly: true, availability: 'unavailable', inputSchema: empty, description: 'No qualified explicit device/SDK/telemetry adapter; no device selected or counter fabricated.' });
    return runner;
}
