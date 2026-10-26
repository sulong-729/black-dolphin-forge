import { mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { servicePlan } from './plan.js';
import { KitError } from '../contracts/errors.js';
import { platformPaths } from '../platform/paths.js';
import { statusDaemon } from '../daemon/lifecycle.js';
export function currentServicePlan(cli: string, state = platformPaths().state) { return servicePlan({ platform: process.platform, home: os.homedir(), node: process.execPath, cli: path.resolve(cli), state: path.resolve(state), username: process.platform === 'win32' ? ((process.env.USERDOMAIN ? process.env.USERDOMAIN + '\\' : '') + os.userInfo().username) : os.userInfo().username, uid: process.getuid?.() }); }
async function command(action: {
    command: string;
    args: string[];
}) { return new Promise<{
    code: number | null;
    output: string;
}>(resolve => { const child = spawn(action.command, action.args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; for (const s of [child.stdout, child.stderr])
    s.on('data', b => { output = (output + b.toString()).slice(-4000); }); const timer = setTimeout(() => child.kill(), 10000); child.once('error', () => { }); child.once('close', code => { clearTimeout(timer); resolve({ code, output }); }); }); }
export async function controlService(action: 'install' | 'uninstall' | 'status', cli: string, state = platformPaths().state) {
    const plan = currentServicePlan(cli, state), record = path.join(state, 'service-registration.json');
    if (action === 'status')
        return { plan, registration: await readFile(record, 'utf8').then(JSON.parse).catch(() => null), system: await command(plan.status) };
    await mkdir(state, { recursive: true, mode: 0o700 });
    if (action === 'install') {
        if (await statusDaemon(state))
            throw new KitError('CONFLICT', 'Stop the manual daemon before installing a user service');
        try {
            await lstat(record);
            throw new KitError('CONFLICT', 'Service already has a registration record');
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
                throw e;
        }
        await mkdir(path.dirname(plan.file), { recursive: true });
        const content = process.platform === 'win32' ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(plan.contents, 'utf16le')]) : plan.contents;
        await writeFile(plan.file, content, { flag: 'wx', mode: 0o600 });
        await writeFile(record, JSON.stringify({ version: 1, label: plan.label, file: plan.file, cli: path.resolve(cli), status: 'pending' }), { mode: 0o600 });
        const result = await command(plan.install);
        if (result.code !== 0)
            throw new KitError('UNAVAILABLE_CAPABILITY', 'OS registration outcome requires inspection through service status: ' + result.output);
        await writeFile(record, JSON.stringify({ version: 1, label: plan.label, file: plan.file, cli: path.resolve(cli), status: 'installed' }), { mode: 0o600 });
        return { installed: true, scope: plan.scope, label: plan.label };
    }
    const owned = JSON.parse(await readFile(record, 'utf8'));
    if (owned.version !== 1 || owned.label !== plan.label || owned.file !== plan.file)
        throw new KitError('CONFLICT', 'Service ownership record differs');
    const result = await command(plan.uninstall);
    if (result.code !== 0)
        throw new KitError('CONFLICT', 'OS service removal failed: ' + result.output);
    await rm(plan.file);
    await rm(record);
    return { uninstalled: true, statePreserved: true };
}
