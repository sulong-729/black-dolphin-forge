import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
export function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export interface Proposal {
    id: string;
    hash: string;
    projectId: string;
    session: string;
    document: string;
    revision: string;
    schema: string;
    created: number;
    expires: number;
    ownerPlan: string;
    preview: unknown;
    instance: string;
}
export interface Journal {
    proposal: Proposal;
    attempt?: {
        key: string;
        status: 'pending' | 'done';
        result?: unknown;
    };
}
const validId = (id: string) => { if (!/^[a-f\d-]{36}$/.test(id))
    throw new KitError('NOT_FOUND', 'Proposal not found'); return id; };
export class MutationPolicy {
    readonly directory: string;
    private count = 0;
    constructor(state: string, readonly instance: string) { this.directory = path.join(state, 'mutations'); }
    private file(id: string) { return path.join(this.directory, validId(id) + '.json'); }
    async write(record: Journal) { await mkdir(this.directory, { recursive: true, mode: 0o700 }); const file = this.file(record.proposal.id), temp = file + '.' + randomUUID() + '.tmp'; await writeFile(temp, JSON.stringify(record), { mode: 0o600 }); await rename(temp, file); }
    async create(data: Omit<Proposal, 'id' | 'hash' | 'created' | 'expires' | 'instance'>) { if (this.count >= 100)
        throw new KitError('RESOURCE_LIMIT', '100 proposals per daemon; restart after reconciliation'); const created = Date.now(), proposal = { ...data, id: randomUUID(), created, expires: created + 300000, instance: this.instance, hash: '' }; proposal.hash = digest({ ...proposal, hash: undefined }); await this.write({ proposal }); this.count++; return proposal; }
    async read(id: string): Promise<Journal> { try {
        return JSON.parse(await readFile(this.file(id), 'utf8'));
    }
    catch (e) {
        if (e instanceof KitError)
            throw e;
        throw new KitError('NOT_FOUND', 'Proposal not found');
    } }
    async authorize(proposal: Proposal) { if (proposal.instance !== this.instance || Date.now() >= proposal.expires)
        throw new KitError('STALE_HANDLE', 'Proposal expired or daemon restarted'); let grant; try {
        grant = JSON.parse(await readFile(path.join(this.directory, proposal.id + '.approval.json'), 'utf8'));
    }
    catch {
        throw new KitError('AUTHORIZATION_REQUIRED', 'Review exact proposal, then approve through the local CLI');
    } if (grant.hash !== proposal.hash || grant.expires !== proposal.expires)
        throw new KitError('AUTHORIZATION_REQUIRED', 'Approval does not match exact proposal'); }
}
// Trusted host/local-user action. This function is deliberately not registered as RPC/MCP.
export async function approveProposal(state: string, id: string, hash: string) { const store = new MutationPolicy(state, 'local-approver'), record = await store.read(id), p = record.proposal; if (hash !== p.hash)
    throw new KitError('CONFLICT', 'Review hash differs'); if (Date.now() >= p.expires || record.attempt)
    throw new KitError('STALE_HANDLE', 'Expired or already attempted proposal'); const file = path.join(store.directory, p.id + '.approval.json'); await writeFile(file, JSON.stringify({ hash: p.hash, expires: p.expires }), { mode: 0o600, flag: 'wx' }); return { proposal: p.id, hash: p.hash, expires: p.expires, approved: true }; }
