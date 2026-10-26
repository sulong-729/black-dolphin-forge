import { KitError } from '../contracts/errors.js';
import type { SourceCapture } from './roots.js';
export function sourceFile(capture: SourceCapture, uri: string) {
    const matches = [...capture.files.values()].filter(f => f.uri === uri);
    if (matches.length !== 1)
        throw new KitError(matches.length ? 'AMBIGUOUS_TARGET' : 'PATH_OUTSIDE_PROJECT', 'Source URI not uniquely captured');
    return matches[0];
}
export function sliceSource(capture: SourceCapture, uri: string, expectedHash: string, query: {
    start?: number;
    end?: number;
    offset?: number;
}) {
    const file = sourceFile(capture, uri);
    if (file.hash !== expectedHash)
        throw new KitError('STALE_REVISION', 'Source hash differs from resolved range');
    const start = query.start ?? 0, end = query.end ?? file.text.length, offset = query.offset ?? 0;
    if (![start, end, offset].every(Number.isSafeInteger) || start < 0 || end < start || end > file.text.length || offset < 0 || offset > end - start)
        throw new KitError('SCHEMA_MISMATCH', 'Invalid source slice range/offset');
    const position = start + offset, text = file.text.slice(position, Math.min(end, position + 6000)), next = offset + text.length;
    const at = (p: number) => { const before = file.text.slice(0, p), last = before.lastIndexOf('\n'); return { line: before.split('\n').length, column: p - last, offset: p }; };
    return { uri, hash: file.hash, owner: file.owner, sourceIndexRevision: capture.revision, text, range: { start: at(position), end: at(position + text.length) }, requested: { start, end }, offset, nextOffset: next < end - start ? next : null, totalCharacters: end - start };
}
