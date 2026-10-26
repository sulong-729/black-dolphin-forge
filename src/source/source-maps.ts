import path from 'node:path';
import type { SourceCapture } from './roots.js';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decode(segment: string) {
    const out: number[] = [];
    let value = 0, shift = 0;
    for (const char of segment) {
        const digit = alphabet.indexOf(char);
        if (digit < 0 || shift > 30)
            throw Error('Invalid VLQ');
        value += (digit & 31) * 2 ** shift;
        if (digit & 32)
            shift += 5;
        else {
            out.push(value % 2 ? -(value - 1) / 2 : value / 2);
            value = 0;
            shift = 0;
        }
    }
    if (shift)
        throw Error('Incomplete VLQ');
    return out;
}
export function sourceMapping(capture: SourceCapture, filePath: string, line: number, column: number) {
    const file = capture.files.get(filePath);
    if (!file)
        return { status: 'source-unavailable' };
    const url = /\/\/[#@]\s*sourceMappingURL=([^\s]+)/.exec(file.text)?.[1];
    if (!url)
        return { status: 'no-source-map' };
    if (/^(?:data:|https?:|file:)/i.test(url))
        return { status: 'external-or-embedded-map-unavailable' };
    const mapFile = capture.files.get(path.resolve(path.dirname(file.path), url));
    if (!mapFile)
        return { status: 'map-unavailable' };
    try {
        const map = JSON.parse(mapFile.text);
        if (map.version !== 3 || typeof map.mappings !== 'string' || !Array.isArray(map.sources) || map.sections)
            return { status: 'unsupported-source-map' };
        let source = 0, originalLine = 0, originalColumn = 0;
        const lines = map.mappings.split(';');
        let chosen: {
            source: number;
            line: number;
            column: number;
        } | undefined;
        for (let l = 0; l < Math.min(line, lines.length); l++) {
            let generated = 0;
            for (const segment of lines[l].split(',')) {
                if (!segment)
                    continue;
                const v = decode(segment);
                generated += v[0];
                if (v.length === 1) {
                    if (l === line - 1 && generated <= column - 1)
                        chosen = undefined;
                    continue;
                }
                if (v.length !== 4 && v.length !== 5)
                    throw Error('Invalid mapping segment');
                source += v[1];
                originalLine += v[2];
                originalColumn += v[3];
                if (source < 0 || originalLine < 0 || originalColumn < 0)
                    throw Error('Invalid original position');
                if (l === line - 1 && generated <= column - 1)
                    chosen = { source, line: originalLine, column: originalColumn };
            }
        }
        if (!chosen)
            return { status: 'position-unmapped', mapHash: mapFile.hash };
        const name = map.sources[chosen.source];
        if (typeof name !== 'string')
            throw Error('Invalid source index');
        const original = capture.files.get(path.resolve(path.dirname(mapFile.path), map.sourceRoot || '', name));
        if (!original)
            return { status: 'source-unavailable', mapHash: mapFile.hash };
        return { status: 'mapped', mapHash: mapFile.hash, original: { uri: original.uri, path: original.path, hash: original.hash, owner: original.owner, line: chosen.line + 1, column: chosen.column + 1 }, precision: 'mapped-point-only', sourceIndexRevision: capture.revision };
    }
    catch {
        return { status: 'malformed-source-map' };
    }
}
