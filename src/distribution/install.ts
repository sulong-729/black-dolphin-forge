import { mkdir, readFile, writeFile, rename, readdir, lstat, realpath, rm, rmdir, open, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileHash } from '../build/fingerprints.js';
import { KitError } from '../contracts/errors.js';
import { readDocument } from '../daemon/read-document.js';
const tool = 'black-dolphin-forge', versionPattern = /^\d+\.\d+\.\d+$/;
interface Manifest {
    formatVersion: number;
    stateFormatVersion: number;
    tool: string;
    version: string;
    files: Record<string, {
        sha256: string;
        bytes: number;
    }>;
}
function relative(p: string) { if (!p || p.includes('\\') || p.includes(':') || p.startsWith('/') || p.split('/').some(s => !s || s === '.' || s === '..'))
    throw new KitError('INTEGRITY_ERROR', 'Invalid bundle path'); return p; }
async function regular(root: string, p: string) { relative(p); const base = await realpath(root); let current = root; for (const part of p.split('/')) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink())
        throw new KitError('INTEGRITY_ERROR', 'Symlink in bundle/installation');
} const resolved = await realpath(current), rel = path.relative(base, resolved); if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel))
    throw new KitError('PATH_OUTSIDE_PROJECT', 'Bundle file escapes root'); return current; }
export async function verifyBundle(root: string): Promise<Manifest> { if ((await lstat(root)).isSymbolicLink())
    throw new KitError('INTEGRITY_ERROR', 'Symlinked bundle root'); const meta = JSON.parse((await readDocument(await regular(root, 'bundle.manifest.json'), 8 * 1024 * 1024)).toString('utf8')) as Manifest; if (meta.formatVersion !== 1 || meta.stateFormatVersion !== 1)
    throw new KitError('UNSUPPORTED_OPERATION', 'Incompatible bundle/state format; current installation preserved'); if (meta.tool !== tool || !versionPattern.test(meta.version) || !meta.files || typeof meta.files !== 'object' || Array.isArray(meta.files))
    throw new KitError('INTEGRITY_ERROR', 'Invalid bundle manifest'); const entries = Object.entries(meta.files); if (entries.length > 50000 || !meta.files['dist/cli/main.js'] || !meta.files['package.json'])
    throw new KitError('INTEGRITY_ERROR', 'Incomplete/oversized bundle'); let bytes = 0; for (const [p, expected] of entries) {
    if (!expected || !Number.isSafeInteger(expected.bytes) || expected.bytes < 0 || !/^[a-f0-9]{64}$/.test(expected.sha256))
        throw new KitError('INTEGRITY_ERROR', 'Invalid file checksum/length');
    const file = await regular(root, p), s = await lstat(file);
    bytes += s.size;
    if (!s.isFile() || s.size !== expected.bytes || bytes > 512 * 1024 * 1024 || await fileHash(file) !== expected.sha256)
        throw new KitError('INTEGRITY_ERROR', 'Bundle checksum/size mismatch: ' + p);
} const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); if (pkg.name !== 'cocos-ai-toolkit' || pkg.version !== meta.version)
    throw new KitError('INTEGRITY_ERROR', 'Package and manifest versions differ'); return meta; }
async function pointer(root: string) { const m = JSON.parse(await readFile(path.join(root, 'installation.json'), 'utf8')); if (m.tool !== tool || m.formatVersion !== 1)
    throw new KitError('CONFLICT', 'Not a compatible Forge installation'); const c = JSON.parse(await readFile(path.join(root, 'current.json'), 'utf8')); if (!versionPattern.test(c.version) || c.previous !== null && !versionPattern.test(c.previous))
    throw new KitError('INTEGRITY_ERROR', 'Invalid installation pointer'); return c as {
    version: string;
    previous: string | null;
}; }
async function atomic(root: string, name: string, value: unknown) { const tmp = path.join(root, '.' + randomUUID() + '.tmp'); await writeFile(tmp, JSON.stringify(value), { mode: 0o600 }); await rename(tmp, path.join(root, name)); }
async function ownedRoot(root: string) { await mkdir(root, { recursive: true, mode: 0o700 }); if ((await lstat(root)).isSymbolicLink())
    throw new KitError('CONFLICT', 'Installation root cannot be a symlink'); const entries = await readdir(root); if (entries.length) {
    let m;
    try {
        m = JSON.parse(await readFile(path.join(root, 'installation.json'), 'utf8'));
    }
    catch { }
    if (m?.tool !== tool || m?.formatVersion !== 1)
        throw new KitError('CONFLICT', 'Destination contains unrelated files');
}
else
    await atomic(root, 'installation.json', { tool, formatVersion: 1, launcherHash: createHash('sha256').update(launcher).digest('hex') }); }
async function locked<T>(root: string, fn: () => Promise<T>) { await ownedRoot(root); let lock; try {
    lock = await open(path.join(root, 'install.lock'), 'wx', 0o600);
}
catch {
    throw new KitError('CONFLICT', 'Another install/recovery lock exists; inspect before retry');
} try {
    return await fn();
}
finally {
    await lock.close();
    await rm(path.join(root, 'install.lock'));
} }
const launcher = `import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';\nconst root=path.dirname(fileURLToPath(import.meta.url)),p=JSON.parse(await fs.readFile(path.join(root,'current.json'),'utf8'));if(!/^\\d+\\.\\d+\\.\\d+$/.test(p.version))throw Error('Invalid Forge version');const cli=path.join(root,'versions',p.version,'dist/cli/main.js');process.env.COCOS_AI_LAUNCHER=path.join(root,'forge.mjs');process.argv=[process.execPath,cli,...process.argv.slice(2)];await import(pathToFileURL(cli).href);\n`;
async function checkLauncher(root: string) { let s; try {
    s = await lstat(path.join(root, 'forge.mjs'));
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        return;
    throw e;
} if (s.isSymbolicLink() || !s.isFile())
    throw new KitError('INTEGRITY_ERROR', 'Launcher is not an owned regular file'); const marker = JSON.parse(await readDocument(await regular(root, 'installation.json'), 65536).then(b => b.toString('utf8'))), expected = marker.launcherHash ?? createHash('sha256').update(launcher).digest('hex'); if (await fileHash(path.join(root, 'forge.mjs')) !== expected)
    throw new KitError('INTEGRITY_ERROR', 'Launcher was modified; installation preserved'); }
async function activateLauncher(root: string) { const tmp = path.join(root, '.launcher-' + randomUUID() + '.tmp'); try {
    await writeFile(tmp, launcher, { mode: 0o700, flag: 'wx' });
    await rename(tmp, path.join(root, 'forge.mjs'));
}
finally {
    await rm(tmp, { force: true });
} }
export async function installBundle(bundle: string, root: string) { const meta = await verifyBundle(bundle); return locked(root, async () => { let current: {
    version: string;
    previous: string | null;
} | undefined; try {
    current = await pointer(root);
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        throw e;
} await checkLauncher(root); if (current?.version === meta.version)
    throw new KitError('CONFLICT', 'Version already installed'); const versions = path.join(root, 'versions'); await mkdir(versions, { recursive: true, mode: 0o700 }); if ((await lstat(versions)).isSymbolicLink())
    throw new KitError('INTEGRITY_ERROR', 'Symlinked versions directory'); const target = path.join(versions, meta.version), stage = path.join(root, '.stage-' + randomUUID()); try {
    await lstat(target);
    throw new KitError('CONFLICT', 'Version directory already exists');
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        throw e;
} await mkdir(stage, { mode: 0o700 }); try {
    for (const file of [...Object.keys(meta.files), 'bundle.manifest.json']) {
        const out = path.join(stage, relative(file));
        await mkdir(path.dirname(out), { recursive: true, mode: 0o700 });
        await copyFile(await regular(bundle, file), out);
    }
    await verifyBundle(stage);
    await rename(stage, target);
    await activateLauncher(root);
    await atomic(root, 'installation.json', { tool, formatVersion: 1, launcherHash: createHash('sha256').update(launcher).digest('hex') });
    await atomic(root, 'current.json', { version: meta.version, previous: current?.version ?? null });
    return installed(root);
}
finally {
    await rm(stage, { recursive: true, force: true });
} }); }
export async function installed(root: string) { const p = await pointer(root); return { ...p, stateFormatVersion: 1, root, launcher: path.join(root, 'forge.mjs'), cli: path.join(root, 'versions', p.version, 'dist/cli/main.js') }; }
export async function rollbackBundle(root: string) { return locked(root, async () => { const p = await pointer(root); if (!p.previous)
    throw new KitError('NOT_FOUND', 'No previous version'); await verifyBundle(path.join(root, 'versions', p.previous)); await atomic(root, 'current.json', { version: p.previous, previous: p.version }); return installed(root); }); }
export async function uninstallBundle(root: string) { return locked(root, async () => { await pointer(root); await checkLauncher(root); const versions = path.join(root, 'versions'); if ((await lstat(versions)).isSymbolicLink())
    throw new KitError('INTEGRITY_ERROR', 'Symlinked versions directory'); const checked: {
    dir: string;
    meta: Manifest;
}[] = []; for (const name of await readdir(versions)) {
    if (!versionPattern.test(name))
        continue;
    const dir = path.join(versions, name);
    checked.push({ dir, meta: await verifyBundle(dir) });
} for (const { dir, meta } of checked) {
    for (const file of [...Object.keys(meta.files), 'bundle.manifest.json'])
        await rm(path.join(dir, file));
    const prune = async (p: string) => { for (const e of await readdir(p, { withFileTypes: true }))
        if (e.isDirectory() && !e.isSymbolicLink())
            await prune(path.join(p, e.name)); await rmdir(p).catch(() => { }); };
    await prune(dir);
} for (const name of ['forge.mjs', 'current.json'])
    await rm(path.join(root, name), { force: true }); await rmdir(versions).catch(() => { }); return { uninstalled: true, statePreserved: true, rootPreserved: true }; }); }
