import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { platformPaths } from '../platform/paths.js';
import { KitError } from '../contracts/errors.js';
import { ResultSchema } from '../contracts/envelopes.js';
import type { Endpoint } from './server.js';
export async function endpoint(state = platformPaths().state): Promise<Endpoint> { const value = JSON.parse(await readFile(path.join(state, 'endpoint.json'), 'utf8')); const url = new URL(value.url); if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !url.port || !Number.isInteger(value.pid) || value.pid <= 0 || typeof value.instanceId !== 'string' || !/^\w{8}-[\w-]+$/.test(value.instanceId) || !/^\w{64}$/.test(value.token))
    throw new KitError('UNAUTHORIZED', 'Invalid daemon endpoint'); return value; }
export async function health(value: Endpoint) { try {
    const r = await fetch(value.url + '/health', { headers: { Authorization: 'Bearer ' + value.token }, signal: AbortSignal.timeout(1500), redirect: 'error' });
    if (!r.ok)
        return false;
    const b: any = await r.json();
    return b.service === 'cocos-ai-toolkit' && b.instanceId === value.instanceId && b.pid === value.pid;
}
catch {
    return false;
} }
export async function call(request: unknown, state = platformPaths().state, tool?: string) { const value = await endpoint(state); const r = await fetch(value.url + '/v1/rpc', { method: 'POST', headers: { Authorization: 'Bearer ' + value.token, 'Content-Type': 'application/json', ...(tool?{'X-Cocos-Tool':tool}:{}) }, body: JSON.stringify(request), signal: AbortSignal.timeout(20000), redirect: 'error' }); const body = ResultSchema.parse(await r.json()); return body; }
