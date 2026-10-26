import { randomUUID } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
import type { RevisionVector } from './revisions.js';
export interface CaptureContext {
    projectId: string;
    source: 'disk' | 'editor' | 'runtime';
    document: string;
    session: string | null;
    revision: RevisionVector;
    data: unknown;
    warnings: string[];
    observed?: {
        start: number;
        end: number;
        consistentFrame: boolean;
        frame?: number;
    };
}
export interface Snapshot extends CaptureContext {
    id: string;
}
interface Entry {
    value: Snapshot;
    bytes: number;
    last: number;
    resource?: unknown;
}
export interface Scope {
    projectId?: string;
    source?: string;
    session?: string | null;
}
function freeze<T>(value: T): T { if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value))
        freeze(v);
} return value; }
export class SnapshotStore {
    private validate?: (snapshot: Snapshot) => void;
    private entries = new Map<string, Entry>();
    private handles = new Map<string, {
        snapshot: string;
        fields: (string | number)[];
    }>();
    private bytes = 0;
    private clock: () => number;
    private ttl: number;
    private maxCount: number;
    private maxBytes: number;
    constructor(options: {
        validate?: (snapshot: Snapshot) => void;
        clock?: () => number;
        ttl?: number;
        maxCount?: number;
        maxBytes?: number;
    } = {}) { this.validate=options.validate; this.clock = options.clock || Date.now; this.ttl = options.ttl ?? 300000; this.maxCount = options.maxCount ?? 10; this.maxBytes = options.maxBytes ?? 128 * 1024 * 1024; }
    get limits() { return Object.freeze({ ttl: this.ttl, maxCount: this.maxCount, maxBytes: this.maxBytes }); }
    capture(input: CaptureContext, retained?: {resource:unknown;bytes:number}): Snapshot { if (input.source === 'runtime' && (!input.observed || input.observed.end < input.observed.start || input.observed.consistentFrame && input.observed.frame === undefined))
        throw new KitError('SCHEMA_MISMATCH', 'Runtime capture needs truthful observation window/frame metadata'); const value = freeze(structuredClone({ ...input, id: randomUUID() })); if(retained&&(!Number.isSafeInteger(retained.bytes)||retained.bytes<0))throw new KitError('SCHEMA_MISMATCH','Invalid retained resource budget'); const bytes = Buffer.byteLength(JSON.stringify(value))+(retained?.bytes||0); if (bytes > this.maxBytes || this.maxCount < 1)
        throw new KitError('RESOURCE_LIMIT', 'Snapshot exceeds budget'); this.sweep(); while (this.entries.size >= this.maxCount || this.bytes + bytes > this.maxBytes)
        this.expire(this.entries.keys().next().value!); this.entries.set(value.id, { value, bytes, last: this.clock(), resource:retained?.resource }); this.bytes += bytes; return value; }
    get(id: string, scope: Scope = {}): Snapshot { this.sweep(); let entry = this.entries.get(id); if(entry) { this.validate?.(entry.value); entry=this.entries.get(id); } if (!entry)
        throw new KitError('SNAPSHOT_EXPIRED', 'Snapshot expired or was evicted', 'Capture a new snapshot; do not reuse stale handles.'); if (scope.projectId && entry.value.projectId !== scope.projectId)
        throw new KitError('FOREIGN_PROJECT', 'Snapshot belongs to another project'); if (scope.source && entry.value.source !== scope.source || scope.session !== undefined && entry.value.session !== scope.session)
        throw new KitError('PROCESS_MISMATCH', 'Snapshot source/session mismatch'); entry.last = this.clock(); this.entries.delete(id); this.entries.set(id, entry); return entry.value; }
    resource(id:string,scope:Scope={}){this.get(id,scope);const resource=this.entries.get(id)!.resource;if(resource===undefined)throw new KitError('UNSUPPORTED_OPERATION','Snapshot has no private graph resource');return resource;}
    expire(id: string) { const entry = this.entries.get(id); if (entry) {
        this.bytes -= entry.bytes;
        this.entries.delete(id);
    } for (const [h, v] of this.handles)
        if (v.snapshot === id)
            this.handles.delete(h); }
    expireSession(session: string) { for(const [id,entry] of this.entries) if(entry.value.source==='editor'&&entry.value.session===session)this.expire(id); }
    private sweep() { for (const [id, entry] of this.entries)
        if (this.clock() - entry.last >= this.ttl)
            this.expire(id); }
    handle(snapshot: string, fields: (string | number)[]) { this.get(snapshot); const h = randomUUID(); this.handles.set(h, { snapshot, fields: [...fields] }); return h; }
    resolve(handle: string, scope: Scope = {}) { const h = this.handles.get(handle); if (!h)
        throw new KitError('STALE_HANDLE', 'Handle expired'); let snapshot: Snapshot; try {
        snapshot = this.get(h.snapshot, scope);
    }
    catch (e) {
        if ((e as KitError).code === 'SNAPSHOT_EXPIRED')
            throw new KitError('STALE_HANDLE', 'Handle snapshot expired');
        throw e;
    } let value: any = snapshot.data; for (const field of h.fields)
        value = value?.[field]; return value; }
}
