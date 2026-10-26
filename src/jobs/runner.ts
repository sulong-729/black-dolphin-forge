import { digest } from '../mutation/policy.js';
import { StringDecoder } from 'node:string_decoder';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, readdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
export interface WorkerStep {
    name: string;
    executable: string;
    args: string[];
    task: string;
    params: unknown;
    cwd: string;
    timeoutMs: number;
}
export interface JobSpec {
    projectId: string;
    key: string;
    requestHash: string;
    steps: WorkerStep[];
    finalize?: (record: JobRecord) => Promise<unknown>;
}
type Status = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed-out' | 'interrupted';
export interface JobRecord {
    id: string;
    projectId: string;
    key: string;
    requestHash: string;
    status: Status;
    created: number;
    ended?: number;
    stages: {
        name: string;
        status: string;
        data?: any;
        error?: string;
    }[];
}
const active = (s: Status) => s === 'queued' || s === 'running';
export class JobRunner {
    readonly ready: Promise<void>;
    private records = new Map<string, JobRecord>();
    private children = new Map<string, ChildProcess>();
    private reasons = new Map<string, Status>();
    private tasks = new Map<string, Promise<void>>();
    private queue: Promise<unknown> = Promise.resolve();
    private closed = false;
    private recoveryFailure = false;
    constructor(readonly directory: string) { this.ready = this.recover().catch(() => { this.recoveryFailure = true; }); }
    private async recover() { await mkdir(this.directory, { recursive: true, mode: 0o700 }); for (const e of await readdir(this.directory, { withFileTypes: true })) {
        if (!e.isDirectory() || !/^[a-f0-9-]{36}$/.test(e.name))
            continue;
        const record = JSON.parse(await readFile(path.join(this.directory, e.name, 'job.json'), 'utf8')) as JobRecord;
        if (active(record.status)) {
            record.status = 'interrupted';
            record.ended = Date.now();
            await this.save(record);
        }
        this.records.set(record.id, record);
    } }
    private async save(r: JobRecord) { const dir = path.join(this.directory, r.id); await mkdir(dir, { recursive: true, mode: 0o700 }); const tmp = path.join(dir, randomUUID() + '.tmp'); await writeFile(tmp, JSON.stringify(r), { mode: 0o600 }); await rename(tmp, path.join(dir, 'job.json')); }
    async start(spec: JobSpec) { await this.ready; const task = this.queue.then(async () => { if (this.recoveryFailure)
        throw new KitError('INTEGRITY_ERROR', 'Job journal corrupt; inspect local state before continuing'); if (this.closed)
        throw new KitError('UNAVAILABLE_CAPABILITY', 'Job runner closed'); const prior = [...this.records.values()].find(r => r.projectId === spec.projectId && r.key === spec.key); if (prior) {
        if (prior.requestHash !== spec.requestHash)
            throw new KitError('CONFLICT', 'Idempotency key already binds another request');
        return structuredClone(prior);
    } for (const r of this.records.values())
        if (r.projectId === spec.projectId && r.status === 'interrupted') {
            let grant;
            try {
                grant = JSON.parse(await readFile(path.join(this.directory, r.id, 'reconcile.json'), 'utf8'));
            }
            catch { }
            if (grant?.hash !== digest(r))
                throw new KitError('CONFLICT', 'Interrupted job needs exact local reconciliation before new builds');
        } if ([...this.records.values()].some(r => r.projectId === spec.projectId && active(r.status)))
        throw new KitError('CONFLICT', 'Project already has an owned job'); if ([...this.records.values()].filter(r => active(r.status)).length >= 2 || this.records.size >= 200)
        throw new KitError('RESOURCE_LIMIT', 'Job capacity reached; reconcile and archive state'); const record: JobRecord = { id: randomUUID(), projectId: spec.projectId, key: spec.key, requestHash: spec.requestHash, status: 'queued', created: Date.now(), stages: [] }; await this.save(record); this.records.set(record.id, record); const work = this.execute(record, spec).catch(async () => { record.status = 'failed'; record.ended = Date.now(); await this.save(record); }).finally(() => this.tasks.delete(record.id)); this.tasks.set(record.id, work); return structuredClone(record); }); this.queue = task.catch(() => { }); return task; }
    async status(projectId: string, id: string) { await this.ready; if (this.recoveryFailure)
        throw new KitError('INTEGRITY_ERROR', 'Job journal corrupt'); const r = this.records.get(id); if (!r)
        throw new KitError('NOT_FOUND', 'Job not found'); if (r.projectId !== projectId)
        throw new KitError('FOREIGN_PROJECT', 'Job belongs to another project'); return { ...structuredClone(r), ...(r.status === 'interrupted' ? { reconciliationHash: digest(r) } : {}) }; }
    private async terminate(id: string) {
        const child = this.children.get(id);
        if (!child || process.platform === 'win32' && (child.exitCode !== null || child.signalCode !== null))
            return;
        const exited = new Promise<void>(r => child.once('close', () => r()));
        if (process.platform === 'win32') {
            await new Promise<void>(resolve => { const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); killer.once('error', () => resolve()); killer.once('close', () => resolve()); });
        }
        else {
            try {
                process.kill(-child.pid!, 'SIGTERM');
            }
            catch { }
            const timer = setTimeout(() => { try {
                process.kill(-child.pid!, 'SIGKILL');
            }
            catch { } }, 750);
            try {
                await exited;
            }
            finally {
                clearTimeout(timer);
            }
        }
    }
    async cancel(projectId: string, id: string) { const r = await this.status(projectId, id); if (active(r.status)) {
        this.reasons.set(id, 'cancelled');
        await this.terminate(id);
        await this.tasks.get(id);
    } return this.status(projectId, id); }
    async close() { await this.ready; this.closed = true; await this.queue; for (const r of this.records.values())
        if (active(r.status))
            this.reasons.set(r.id, 'interrupted'); await Promise.all([...this.children.keys()].map(id => this.terminate(id))); await Promise.all(this.tasks.values()); }
    private async execute(record: JobRecord, spec: JobSpec) { record.status = 'running'; await this.save(record); for (const step of spec.steps) {
        if (this.reasons.has(record.id))
            break;
        const stage: {
            name: string;
            status: string;
            data?: any;
            error?: string;
        } = { name: step.name, status: 'running' };
        record.stages.push(stage);
        await this.save(record);
        try {
            const params = typeof step.params === 'function' ? (step.params as (r: JobRecord) => unknown)(record) : step.params;
            stage.data = await this.worker(record.id, { ...step, params });
            stage.status = 'succeeded';
        }
        catch (e) {
            stage.status = 'failed';
            stage.error = e instanceof Error ? e.message : 'Worker failed';
            record.status = this.reasons.get(record.id) ?? 'failed';
            break;
        }
        await this.save(record);
    } if (record.status === 'running' && !this.reasons.has(record.id) && spec.finalize) {
        const stage: {
            name: string;
            status: string;
            data?: any;
            error?: string;
        } = { name: 'artifact', status: 'running' };
        record.stages.push(stage);
        try {
            stage.data = await spec.finalize(record);
            stage.status = 'succeeded';
        }
        catch (e) {
            stage.status = 'failed';
            stage.error = e instanceof Error ? e.message : 'Artifact failed';
            record.status = 'failed';
        }
    } if (this.reasons.has(record.id))
        record.status = this.reasons.get(record.id)!;
    else if (record.status === 'running')
        record.status = 'succeeded'; record.ended = Date.now(); await this.save(record); this.reasons.delete(record.id); }
    private worker(id: string, step: WorkerStep): Promise<any> { return new Promise((resolve, reject) => { if (this.closed || this.reasons.has(id)) {
        reject(Error('Worker cancelled before spawn'));
        return;
    } const child = spawn(step.executable, step.args, { cwd: step.cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] }); this.children.set(id, child); const requestId = randomUUID(), decoder = new StringDecoder('utf8'); let buffer = '', result: any, received = false, problem: string | undefined, bytes = 0, logBytes = 0; let logQueue = Promise.resolve(); const log = (b: Buffer) => { if (logBytes >= 256 * 1024)
        return; const part = b.subarray(0, 256 * 1024 - logBytes); logBytes += part.length; logQueue = logQueue.then(() => appendFile(path.join(this.directory, id, 'log.txt'), part, { mode: 0o600 })).catch(() => { fail('Cannot persist worker log'); }); }; const fail = (message: string) => { if (problem)
        return; problem = message; void this.terminate(id); }; const timer = setTimeout(() => { this.reasons.set(id, 'timed-out'); fail('Worker timed out'); }, step.timeoutMs); child.stderr.on('data', log); child.stdout.on('data', (b: Buffer) => { bytes += b.length; if (bytes > 1024 * 1024) {
        fail('Worker protocol exceeds 1MiB');
        return;
    } buffer += decoder.write(b); let at; while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        try {
            const v = JSON.parse(line);
            if (received || v.version !== 1 || v.id !== requestId || v.type !== 'result' || !Object.hasOwn(v, 'data'))
                throw Error();
            received = true;
            result = v.data;
        }
        catch {
            fail('Malformed or unexpected worker protocol');
        }
    } }); child.once('error', () => { problem = 'Cannot start configured worker'; }); child.stdin.on('error', () => { }); child.once('close', async (code) => { clearTimeout(timer); if (process.platform !== 'win32' && child.pid) {
        try {
            process.kill(-child.pid, 'SIGKILL');
        }
        catch { }
    } this.children.delete(id); try {
        await logQueue;
    }
    catch {
        problem = 'Cannot persist worker log';
    } if (this.reasons.has(id))
        return reject(Error('Worker interrupted')); if (problem || code !== 0 || !received || buffer.trim())
        return reject(Error(problem ?? 'Worker exit/protocol incomplete')); resolve(result); }); child.stdin.end(JSON.stringify({ version: 1, id: requestId, task: step.task, params: step.params }) + '\n'); }); }
}
