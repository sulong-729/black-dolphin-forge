import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
export async function sourceDiagnostic(file: string, p: {
    line: number;
    column: number;
    hash?: string;
}) { if ((await stat(file)).size > 2 * 1024 * 1024)
    throw new KitError('RESOURCE_LIMIT', 'Source diagnostic exceeds 2MiB'); const bytes = await readFile(file), hash = createHash('sha256').update(bytes).digest('hex'); if (p.hash && hash !== p.hash)
    throw new KitError('STALE_REVISION', 'Diagnostic source hash changed'); const lines = bytes.toString('utf8').split(/\r?\n/); if (p.line > lines.length || p.column > lines[p.line - 1].length + 1)
    throw new KitError('SCHEMA_MISMATCH', 'Source range outside file'); const start = Math.max(0, p.line - 3), end = Math.min(lines.length, p.line + 2), text = lines.slice(start, end).join('\n'); return { file, hash, line: p.line, column: p.column, startLine: start + 1, endLine: end, text: text.slice(0, 4000), truncated: text.length > 4000, mapping: 'verified-source-location', runtimeCorrespondence: 'unresolved', sourceMapApplied: false, componentCandidates: 'unresolved', crashReproduced: false }; }
