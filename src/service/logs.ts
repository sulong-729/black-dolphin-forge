import { lstat, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { KitError } from '../contracts/errors.js';
// Rotation happens before an owned writer starts; an already-open file is not truncated.
export async function rotateLog(file: string, maxBytes = 1024 * 1024) { let s; try {
    s = await lstat(file);
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        return { rotated: false };
    throw e;
} if (s.isSymbolicLink() || !s.isFile())
    throw new KitError('INTEGRITY_ERROR', 'Refusing non-regular log file'); if (s.size <= maxBytes)
    return { rotated: false }; const old = file + '.1'; try {
    const prior = await lstat(old);
    if (prior.isSymbolicLink() || !prior.isFile())
        throw new KitError('INTEGRITY_ERROR', 'Refusing non-regular rotated log');
    await rm(old);
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        throw e;
} await rename(file, old); return { rotated: true, retained: path.basename(old), bytes: s.size }; }
