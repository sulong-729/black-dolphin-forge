import { mkdir, readdir, lstat, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileHash } from '../build/fingerprints.js';
import { KitError } from '../contracts/errors.js';
export async function createBundle(repository: string, out: string) {
    try {
        await lstat(out);
        throw new KitError('CONFLICT', 'Bundle destination already exists');
    }
    catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
            throw e;
    }
    const pkg = JSON.parse(await readFile(path.join(repository, 'package.json'), 'utf8')), lock = JSON.parse(await readFile(path.join(repository, 'package-lock.json'), 'utf8'));
    await mkdir(out, { recursive: true, mode: 0o700 });
    const files: Record<string, {
        sha256: string;
        bytes: number;
    }> = {};
    let total = 0;
    async function copy(rel: string) { if (path.basename(rel) === '.DS_Store') return; const input = path.join(repository, rel); let s; try {
        s = await lstat(input);
    }
    catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT')
            return;
        throw e;
    } if (s.isSymbolicLink())
        throw new KitError('INTEGRITY_ERROR', 'Cannot bundle symlink: ' + rel); if (s.isDirectory()) {
        for (const e of await readdir(input))
            await copy(rel + '/' + e);
        return;
    } if (!s.isFile())
        throw new KitError('INTEGRITY_ERROR', 'Unsupported bundle file'); if (rel === 'extensions/cocos-ai-bridge/config.json')
        return; total += s.size; if (total > 512 * 1024 * 1024 || Object.keys(files).length >= 50000)
        throw new KitError('RESOURCE_LIMIT', 'Portable package budget exceeded'); const dest = path.join(out, rel); await mkdir(path.dirname(dest), { recursive: true, mode: 0o700 }); await copyFile(input, dest); files[rel] = { sha256: await fileHash(dest), bytes: s.size }; }
    for (const p of ['dist', 'desktop/public', 'desktop/assets', 'desktop/windows-shortcut.ps1', 'desktop/Launch-Forge.cmd', 'scripts/install-desktop.mjs', 'adapters/python', 'extensions/cocos-ai-bridge', 'skills/cocos-ai-toolkit', 'README.md', 'docs/operations.md', 'docs/compatibility.md', 'docs/acceptance.md', 'docs/runtime.md', 'docs/build.md'])
        await copy(p);
    for (const [p, info] of Object.entries(lock.packages ?? {}) as [
        string,
        any
    ][]) {
        if (!p || info.dev)
            continue;
        if (!/^node_modules\/(?:@[^/]+\/)?[^/]+(?:\/node_modules\/(?:@[^/]+\/)?[^/]+)*$/.test(p))
            throw new KitError('INTEGRITY_ERROR', 'Invalid dependency path');
        const dep = JSON.parse(await readFile(path.join(repository, p, 'package.json'), 'utf8'));
        if (dep.version !== info.version)
            throw new KitError('INTEGRITY_ERROR', 'Installed dependency version differs from lockfile');
        await copy(p);
    }
    const runtime = { ...pkg, scripts: { doctor: 'node dist/cli/main.js describe' }, devDependencies: undefined };
    await writeFile(path.join(out, 'package.json'), JSON.stringify(runtime, null, 2) + '\n');
    files['package.json'] = { sha256: await fileHash(path.join(out, 'package.json')), bytes: (await lstat(path.join(out, 'package.json'))).size };
    const result = { formatVersion: 1, stateFormatVersion: 1, tool: 'black-dolphin-forge', version: pkg.version, files };
    if (!files['dist/cli/main.js'] || !files['skills/cocos-ai-toolkit/SKILL.md'])
        throw new KitError('INTEGRITY_ERROR', 'Build runtime and generate skill before packaging');
    await writeFile(path.join(out, 'bundle.manifest.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    return result;
}
