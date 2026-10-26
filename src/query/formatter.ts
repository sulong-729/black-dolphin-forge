import { createHash } from 'node:crypto';
import { Cursors } from '../snapshots/cursors.js';
import { SnapshotStore } from '../snapshots/store.js';
import { KitError } from '../contracts/errors.js';
export interface Query {
    snapshot: string;
    projectId: string;
    limit?: number;
    depth?: number;
    cursor?: string;
    mode?: 'records' | 'tree';
    source?: 'disk' | 'editor' | 'runtime';
    session?: string | null;
}
export class Formatter {
    private cursors = new Cursors();
    constructor(private snapshots: SnapshotStore) { }
    page(query: Query, projection?: {key:string;items:unknown[]}) {
        const limit = query.limit ?? 50, depth = query.depth ?? 2, mode = query.mode ?? 'records';
        if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(depth) || depth < 0 || depth > 32)
            throw new KitError('SCHEMA_MISMATCH', 'Query limit/depth outside bounds');
        const hash = createHash('sha256').update(JSON.stringify([query.snapshot, query.projectId, limit, depth, mode, query.source ?? null, query.session ?? null,projection?.key??null])).digest('hex');
        const cursor = query.cursor ? this.cursors.read(query.cursor) : { hash, index: 0, offset: 0 };
        if (cursor.hash !== hash)
            throw new KitError('CURSOR_MISMATCH', 'Cursor belongs to a different query');
        const snap = this.snapshots.get(query.snapshot, { projectId: query.projectId, source: query.source, session: query.session });
        const roots = projection?.items ?? (Array.isArray(snap.data) ? snap.data : [snap.data]);
        let items = roots;
        let omittedChildren = 0;
        if (mode === 'tree') {
            items = [];
            const stack = roots.map(node => ({ node, level: 0 })).reverse();
            while (stack.length) {
                const { node, level } = stack.pop()!;
                if (!node || typeof node !== 'object' || Array.isArray(node))
                    throw new KitError('SCHEMA_MISMATCH', 'Tree mode expects normalized nodes with children arrays');
                const { children, ...fields } = node as Record<string, unknown>;
                const kids = Array.isArray(children) ? children : [];
                items.push({ ...fields, depth: level, childrenCount: kids.length });
                if (level < depth) {
                    for (let i = kids.length - 1; i >= 0; i--)
                        stack.push({ node: kids[i], level: level + 1 });
                }
                else
                    omittedChildren += kids.length;
            }
        }
        const page = items.slice(cursor.index, cursor.index + limit), encoded = JSON.stringify(page), text = encoded.slice(cursor.offset, cursor.offset + 6000), end = cursor.offset + text.length;
        const next = end < encoded.length ? { hash, index: cursor.index, offset: end } : cursor.index + limit < items.length ? { hash, index: cursor.index + limit, offset: 0 } : null;
        return { text, count: page.length, total: items.length, depth, projection: mode, omittedChildren, chunked: encoded.length > 6000, offset: cursor.offset, nextCursor: next ? this.cursors.sign(next) : null, dataArtifact: { snapshot: snap.id, kind: 'data' }, warningsArtifact: { snapshot: snap.id, kind: 'warnings', characters: JSON.stringify(snap.warnings).length }, revision: snap.revision };
    }
    warnings(snapshot: string, projectId: string, offset = 0) { const value = this.snapshots.get(snapshot, { projectId }); const encoded = JSON.stringify(value.warnings); const text = encoded.slice(offset, offset + 6000); return { text, nextOffset: offset + text.length < encoded.length ? offset + text.length : null }; }
    batch(queries: Query[]) { return queries.map(q => { try {
        return this.page(q);
    }
    catch (e) {
        return { error: { code: (e as KitError).code || 'INTERNAL_ERROR', message: (e as KitError).message } };
    } }); }
}
