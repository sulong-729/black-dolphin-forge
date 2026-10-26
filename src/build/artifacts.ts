import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
export async function artifactManifest(directory: string, sourceBefore: string, sourceAfter: string) { if ((await lstat(directory)).isSymbolicLink() || !(await lstat(directory)).isDirectory())
    throw new KitError('PATH_OUTSIDE_PROJECT', 'Build output root must be an owned directory'); const canonical = await realpath(directory); const files: {
    path: string;
    size: number;
    sha256: string;
}[] = []; let size = 0; async function walk(dir: string) { for (const e of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name), s = await lstat(file);
    if (s.isSymbolicLink())
        throw new KitError('PATH_OUTSIDE_PROJECT', 'Symlinked build output refused');
    const rel = path.relative(canonical, await realpath(file));
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel))
        throw new KitError('PATH_OUTSIDE_PROJECT', 'Build output escapes canonical root');
    if (s.isDirectory())
        await walk(file);
    else if (s.isFile()) {
        size += s.size;
        if (files.length >= 10000 || size > 512 * 1024 * 1024)
            throw new KitError('RESOURCE_LIMIT', 'Artifact exceeds 10000 files/512MiB');
        files.push({ path: path.relative(directory, file).split(path.sep).join('/'), size: s.size, sha256: createHash('sha256').update(await readFile(file)).digest('hex') });
    }
} } await walk(directory); if (!files.some(f => f.path === 'web-mobile/index.html'))
    throw new KitError('NOT_FOUND', 'Missing required Web Mobile output'); return { version: 1, files, bytes: size, sourceBefore, sourceAfter, stale: sourceBefore !== sourceAfter, cache: 'not-reused', evidence: 'build-output-only', launch: 'NOT_RUN', visual: 'NOT_RUN', device: 'NOT_RUN' }; }
