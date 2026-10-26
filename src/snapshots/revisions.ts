import { KitError } from '../contracts/errors.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export interface RevisionVector {
    data: string;
    schema: string;
    engine: string;
    assets: string;
    sourceIndex: string;
}
export async function revisionOf(files: string[], context: Partial<Omit<RevisionVector, 'data'>> = {}): Promise<RevisionVector> { const h = createHash('sha256'); for (const file of [...files].sort()) {
    const bytes = await readFile(file);
    h.update(JSON.stringify([file, bytes.length]));
    h.update(bytes);
} return { data: h.digest('hex'), schema: context.schema || 'unknown', engine: context.engine || 'unknown', assets: context.assets || 'unknown', sourceIndex: context.sourceIndex || 'unknown' }; }
export function assertRevision(captured: RevisionVector, current: RevisionVector) { if ((Object.keys(captured) as (keyof RevisionVector)[]).some(key => captured[key] !== current[key]))
    throw new KitError('STALE_REVISION', 'Dependencies changed; capture and resolve again before applying.'); }
