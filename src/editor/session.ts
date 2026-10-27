import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
import { qualify, type Handshake, type EditorState } from './version-adapter.js';
export const readCommands = ['scene.capture', 'schema.list', 'schema.describe'] as const;
export type ReadCommand = typeof readCommands[number];
interface Job {
    id: string;
    command: string;
    params: Record<string, unknown>;
    revision: string;
}
interface Pending {
    job: Job;
    sent: boolean;
    resolve: (data: unknown) => void;
    reject: (e: KitError) => void;
    timer: ReturnType<typeof setTimeout>;
}
interface Session {
    id: string;
    lease: string;
    hello: Handshake;
    adapter: string;
    last: number;
    pending: Map<string, Pending>;
}
export class EditorSessions {
    private sessions = new Map<string, Session>();
    private clock: () => number;
    private ttl: number;
    private timeout: number;
    private invalidate: (session: string) => void;
    constructor(options: {
        clock?: () => number;
        ttl?: number;
        timeout?: number;
        invalidate?: (session: string) => void;
    } = {}) { this.clock = options.clock ?? Date.now; this.ttl = options.ttl ?? 15000; this.timeout = options.timeout ?? 8000; this.invalidate = options.invalidate ?? (() => { }); }
    connect(hello: Handshake) {
        const adapter = qualify(hello);
        if(hello.creatorVersion!=='3.7.3')hello={...hello,features:{...hello.features,mutationV1:false}};
        this.sweep();
        if (this.sessions.size >= 16)
            throw new KitError('RESOURCE_LIMIT', 'Maximum 16 Editor sessions');
        for (const s of this.sessions.values())
            if (s.hello.projectId === hello.projectId && s.hello.instance === hello.instance)
                this.remove(s, 'Editor reconnected');
        const s: Session = { id: randomUUID(), lease: randomBytes(32).toString('hex'), hello: structuredClone(hello), adapter, last: this.clock(), pending: new Map() };
        this.sessions.set(s.id, s);
        return { session: s.id, lease: s.lease, adapter, commands: [...readCommands] };
    }
    private sweep() {
        for (const s of this.sessions.values())
            if (this.clock() - s.last >= this.ttl)
                this.remove(s, 'Editor heartbeat expired');
    }
    private remove(s: Session, message: string) {
        this.sessions.delete(s.id);
        this.invalidate(s.id);
        for (const p of s.pending.values()) {
            clearTimeout(p.timer);
            p.reject(new KitError('UNAVAILABLE_CAPABILITY', message));
        }
        s.pending.clear();
    }
    private authenticate(id: string, lease: string) {
        this.sweep();
        const s = this.sessions.get(id);
        if (!s)
            throw new KitError('STALE_HANDLE', 'Editor session expired');
        const a = Buffer.from(lease), b = Buffer.from(s.lease);
        if (a.length !== b.length || !timingSafeEqual(a, b))
            throw new KitError('UNAUTHORIZED', 'Editor lease mismatch');
        s.last = this.clock();
        return s;
    }
    select(projectId: string, id?: string | null) {
        this.sweep();
        const candidates = [...this.sessions.values()].filter(s => s.hello.projectId === projectId);
        const s = id ? this.sessions.get(id) : candidates.length === 1 ? candidates[0] : undefined;
        if (!id && candidates.length > 1)
            throw new KitError('AMBIGUOUS_TARGET', 'Specify an Editor session');
        if (!s)
            throw new KitError(id ? 'STALE_HANDLE' : 'UNAVAILABLE_CAPABILITY', 'No matching live Editor');
        if (s.hello.projectId !== projectId)
            throw new KitError('FOREIGN_PROJECT', 'Editor belongs to another project');
        return { session: s.id, adapter: s.adapter, ...structuredClone(s.hello) };
    }
    list(projectId: string) { this.sweep(); return [...this.sessions.values()].filter(s => s.hello.projectId === projectId).map(s => this.select(projectId, s.id)); }
    heartbeat(id: string, lease: string, state: EditorState) {
        const s = this.authenticate(id, lease);
        const before = s.hello.state;
        if (JSON.stringify(before) !== JSON.stringify(state)) {
            this.invalidate(id);
            for (const p of s.pending.values()) {
                clearTimeout(p.timer);
                p.reject(new KitError('STALE_REVISION', 'Editor document/state changed'));
            }
            s.pending.clear();
        }
        s.hello.state = structuredClone(state);
        return { session: id, state: s.hello.state };
    }
    request(projectId: string, id: string | null | undefined, command: string, params: Record<string, unknown>): Promise<unknown> {
        const selected = this.select(projectId, id), s = this.sessions.get(selected.session)!;
        if (!readCommands.includes(command as ReadCommand))
            throw new KitError('UNSUPPORTED_OPERATION', 'Read command is not allowlisted');
        if (s.hello.state.importing || s.hello.state.stage === 'none')
            throw new KitError('UNAVAILABLE_CAPABILITY', 'Editor importing or no active document');
        if (s.pending.size >= 16)
            throw new KitError('RESOURCE_LIMIT', 'Editor queue full');
        const job: Job = { id: randomUUID(), command: command as ReadCommand, params: structuredClone(params), revision: s.hello.state.revision };
        return new Promise((resolve, reject) => { const timer = setTimeout(() => { s.pending.delete(job.id); reject(new KitError('UNAVAILABLE_CAPABILITY', 'Editor read timed out')); }, this.timeout); s.pending.set(job.id, { job, sent: false, resolve, reject, timer }); });
    }
    requestMutation(projectId:string,id:string,command:string,params:Record<string,unknown>):Promise<unknown> {
        const selected=this.select(projectId,id),s=this.sessions.get(selected.session)!;
        if(!selected.features.mutationV1||!['mutation.prepare','mutation.apply','mutation.rollback.prepare'].includes(command)) throw new KitError('UNSUPPORTED_OPERATION','Mutation command not qualified');
        if(selected.state.importing||selected.state.stage!=='scene') throw new KitError('UNAVAILABLE_CAPABILITY','Mutation requires ready scene');
        if(s.pending.size>=16) throw new KitError('RESOURCE_LIMIT','Editor queue full');
        const job:Job={id:randomUUID(),command,params:structuredClone(params),revision:selected.state.revision};
        return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.pending.delete(job.id);reject(new KitError('UNAVAILABLE_CAPABILITY','Owner acknowledgment timed out; write may have occurred'));},this.timeout);s.pending.set(job.id,{job,sent:false,resolve,reject,timer});});
    }
    poll(id: string, lease: string) {
        const s = this.authenticate(id, lease);
        const jobs = [];
        for (const p of s.pending.values())
            if (!p.sent) {
                p.sent = true;
                jobs.push(p.job);
            }
        return structuredClone(jobs);
    }
    respond(id: string, lease: string, response: {
        id: string;
        revision: string;
        data?: unknown;
        error?: string;
    }) {
        const s = this.authenticate(id, lease), p = s.pending.get(response.id);
        if (!p || !p.sent)
            throw new KitError('STALE_HANDLE', 'Read request expired or not delivered');
        s.pending.delete(response.id);
        clearTimeout(p.timer);
        if (response.revision !== p.job.revision || response.revision !== s.hello.state.revision)
            p.reject(new KitError('STALE_REVISION', 'Editor changed during read'));
        else if (response.error) {
            const prefix = response.error.split(':')[0];
            const code = prefix === 'STALE_REVISION' || prefix === 'RESOURCE_LIMIT' || prefix === 'NOT_FOUND' || prefix === 'AMBIGUOUS_TARGET' || prefix === 'UNSUPPORTED_OPERATION' || prefix === 'SCHEMA_MISMATCH' || prefix === 'CONFLICT' || prefix === 'STALE_HANDLE' ? prefix : 'UNAVAILABLE_CAPABILITY';
            p.reject(new KitError(code, response.error.slice(0, 500)));
        }
        else if (Buffer.byteLength(JSON.stringify(response.data) ?? 'null') > 800000)
            p.reject(new KitError('RESOURCE_LIMIT', 'Editor response exceeds 800 kB; request smaller projection'));
        else {
            if(p.job.command==='mutation.apply') {
                const state=(response.data as any)?.state;
                if(!state||typeof state.revision!=='string'||state.document!==s.hello.state.document||state.schema!==s.hello.state.schema||state.stage!=='scene'||typeof state.dirty!=='boolean'||typeof state.importing!=='boolean') {
                    p.reject(new KitError('INTEGRITY_ERROR','Invalid mutation state acknowledgment'));return {accepted:false};
                }
                this.invalidate(s.id);s.hello.state=structuredClone(state);
            }
            p.resolve(response.data);
        }
        return { accepted: true };
    }
    disconnect(id: string, lease: string) { const s = this.authenticate(id, lease); this.remove(s, 'Editor disconnected'); return { disconnected: true }; }
    close() {
        for (const s of this.sessions.values())
            this.remove(s, 'Daemon stopping');
    }
}
