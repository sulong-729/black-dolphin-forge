import { mkdir, open, readFile, unlink, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { platformPaths } from '../platform/paths.js';
import { createRequest } from '../contracts/envelopes.js';
import { KitError } from '../contracts/errors.js';
import { endpoint, health, call } from './client.js';
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function statusDaemon(state = platformPaths().state) { try {
    const value = await endpoint(state);
    return await health(value) ? value : null;
}
catch {
    return null;
} }
export async function startDaemon(state = platformPaths().state) {
    await mkdir(state, { recursive: true, mode: 0o700 });
    const lock = path.join(state, 'startup.lock');
    let owned = false;
    for (let i = 0; i < 100; i++) {
        const active = await statusDaemon(state);
        if (active)
            return active;
        try {
            const f = await open(lock, 'wx', 0o600);
            await f.writeFile(String(process.pid));
            await f.close();
            owned = true;
            break;
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST')
                throw e;
            try {
                if (Date.now() - (await stat(lock)).mtimeMs > 30000)
                    await unlink(lock);
            }
            catch { }
            await pause(100);
        }
    }
    if (!owned)
        throw new KitError('CONFLICT', 'Daemon start is already in progress; retry status');
    try {
        const active = await statusDaemon(state);
        if (active)
            return active;
        const log = await open(path.join(state, 'daemon.log'), 'a', 0o600);
        let error: Error | undefined;
        const child = spawn(process.execPath, [fileURLToPath(new URL('../cli/main.js', import.meta.url)), 'daemon', 'serve'], { detached: true, windowsHide: true, stdio: ['ignore', log.fd, log.fd], env: { ...process.env, COCOS_AI_STATE_DIR: state } });
        child.on('error', e => { error = e; });
        child.unref();
        await log.close();
        for (let n = 0; n < 100; n++) {
            if (error)
                throw error;
            const s = await statusDaemon(state);
            if (s)
                return s;
            await pause(100);
        }
        throw new KitError('CONFLICT', 'Daemon did not become ready; inspect daemon.log');
    }
    finally {
        await unlink(lock).catch(() => { });
    }
}
export async function stopDaemon(state = platformPaths().state) { const active = await statusDaemon(state); if (!active)
    return false; const result = await call(createRequest('daemon.stop'), state); if (result.status !== 'ok')
    throw new KitError('CONFLICT', 'Daemon stop refused'); for (let i = 0; i < 100; i++) {
    if (!await statusDaemon(state))
        return true;
    await pause(50);
} throw new KitError('CONFLICT', 'Daemon is draining pending requests'); }
