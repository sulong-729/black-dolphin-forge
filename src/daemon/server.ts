import http from 'node:http';
import { mkdir, writeFile, readFile, unlink, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createDispatcher } from './dispatcher.js';
import { errorInfo, KitError } from '../contracts/errors.js';
import { platformPaths } from '../platform/paths.js';
export interface Endpoint {
    url: string;
    token: string;
    pid: number;
    instanceId: string;
}
export async function startServer(options: {
    stateDir?: string;
} = {}) {
    const state = options.stateDir || platformPaths().state;
    await mkdir(state, { recursive: true, mode: 0o700 });
    const token = randomBytes(32).toString('hex'), instanceId = randomUUID();
    let closing: Promise<void> | undefined;
    let stopTimer: NodeJS.Timeout | undefined;
    const core = createDispatcher(state, { instanceId, pid: process.pid }, () => { stopTimer ??= setTimeout(() => { void close(); }, 50); });
    const error = (code: number, e: KitError) => ({ formatVersion: 1, requestId: 'transport', status: 'error', warnings: [], error: errorInfo(e) });
    const server = http.createServer(async (req, res) => {
        const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
        const port = (server.address() as any)?.port;
        if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host || '') || req.headers.origin !== undefined) {
            send(403, error(403, new KitError('UNAUTHORIZED', 'Local authenticated clients only')));
            return;
        }
        const actual = Buffer.from(req.headers.authorization || ''), expected = Buffer.from('Bearer ' + token);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
            send(403, error(403, new KitError('UNAUTHORIZED', 'Invalid credentials')));
            return;
        }
        if (req.method === 'GET' && req.url === '/health') {
            send(200, { service: 'cocos-ai-toolkit', instanceId, pid: process.pid });
            return;
        }
        if (req.method !== 'POST' || req.url !== '/v1/rpc') {
            send(404, error(404, new KitError('NOT_FOUND', 'RPC route not found')));
            return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        let replied = false;
        try {
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 1024 * 1024) {
                    if (!replied) {
                        send(413, error(413, new KitError('REQUEST_TOO_LARGE', 'Request exceeds 1 MiB')));
                        replied = true;
                    }
                    chunks.length = 0;
                }
                else if (!replied)
                    chunks.push(chunk);
            }
            if (replied)
                return;
            let request;
            try {
                request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            }
            catch {
                send(400, error(400, new KitError('SCHEMA_MISMATCH', 'Malformed JSON')));
                return;
            }
            const tool=req.headers['x-cocos-tool'];
            send(200, typeof tool==='string'?await core.facade(tool,{request}):await core.dispatch(request));
        }
        catch {
            if (!replied && !res.headersSent)
                send(400, error(400, new KitError('SCHEMA_MISMATCH', 'Incomplete request')));
        }
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const endpoint: Endpoint = { url: 'http://127.0.0.1:' + (server.address() as any).port, token, pid: process.pid, instanceId };
    const tmp = path.join(state, 'endpoint-' + instanceId + '.tmp');
    await writeFile(tmp, JSON.stringify(endpoint), { mode: 0o600 });
    await rename(tmp, path.join(state, 'endpoint.json'));
    async function close() { if (closing)
        return closing; closing = (async () => { if (stopTimer)
        clearTimeout(stopTimer); core.sessions.close(); await new Promise<void>((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeIdleConnections(); }); try {
        const current = JSON.parse(await readFile(path.join(state, 'endpoint.json'), 'utf8'));
        if (current.instanceId === instanceId)
            await unlink(path.join(state, 'endpoint.json'));
    }
    catch { } })(); return closing; }
    return { ...endpoint, ...core, close };
}
