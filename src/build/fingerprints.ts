import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { KitError } from '../contracts/errors.js';
// Generated root state is not input; nested folders and installed dependencies ARE inputs.
const excluded = new Set(['.git', 'library', 'temp', 'build', 'profiles', '.superpowers']);
export async function fingerprint(root: string, budget: {
    maxBytes: number;
    maxFiles: number;
    excludePaths?: string[];
} = { maxBytes: 512 * 1024 * 1024, maxFiles: 50000 }) { const hash = createHash('sha256'); let bytes = 0, count = 0; async function walk(dir: string) { for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (dir === root && excluded.has(entry.name))
        continue;
    const file = path.join(dir, entry.name), rel = path.relative(root, file).split(path.sep).join('/');
    if(budget.excludePaths?.includes(rel))continue;
    const info = await lstat(file);
    if (info.isSymbolicLink())
        throw new KitError('UNSUPPORTED_OPERATION', 'Build input symlinks require a qualified dependency adapter: ' + rel);
    if (info.isDirectory())
        await walk(file);
    else if (info.isFile()) {
        if (++count > budget.maxFiles || info.size > budget.maxBytes - bytes)
            throw new KitError('RESOURCE_LIMIT', 'Build fingerprint exceeds configured file/byte budget');
        hash.update(rel + '\0');
        for await (const chunk of createReadStream(file)) {
            bytes += chunk.length;
            if (bytes > budget.maxBytes)
                throw new KitError('RESOURCE_LIMIT', 'Input grew beyond fingerprint budget');
            hash.update(chunk);
        }
        hash.update('\0');
    }
} } if ((await lstat(root)).isSymbolicLink())
    throw new KitError('PATH_OUTSIDE_PROJECT', 'Build input root is a symlink'); await walk(root); return { hash: hash.digest('hex'), files: count, bytes, coverage: 'content-excluding-generated-v2', excludedPaths: [...excluded, ...(budget.excludePaths??[])] }; }
export async function fileHash(file: string) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file))
    hash.update(chunk); return hash.digest('hex'); }
