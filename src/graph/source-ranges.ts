import ts from 'typescript';
import { KitError } from '../contracts/errors.js';
import type { PatchStep } from './patch.js';
/** Locate existing JSON value tokens. Untouched bytes, including opaque numeric lexemes, are never re-encoded. */
export function sourceRanges(raw: string) {
    const source = ts.parseJsonText('source.prefab', raw);
    if (!source.statements[0] || !ts.isExpressionStatement(source.statements[0]) || !ts.isArrayLiteralExpression(source.statements[0].expression))
        throw new KitError('SCHEMA_MISMATCH', 'Source token ranges cannot be parsed safely');
    const root = source.statements[0].expression;
    return (slot: number, selector: PatchStep['selector']) => {
        let node: ts.Expression = root.elements[slot];
        for (const segment of selector) {
            if ('field' in segment) {
                if (!ts.isObjectLiteralExpression(node)) throw new KitError('SCHEMA_MISMATCH', 'Source selector is not an object');
                const matches = node.properties.filter((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)) && p.name.text === segment.field);
                if (!matches.length) throw new KitError('SCHEMA_MISMATCH', 'Source property token missing');
                node = matches[matches.length - 1].initializer;
            } else {
                if (!ts.isArrayLiteralExpression(node) || !node.elements[segment.index]) throw new KitError('SCHEMA_MISMATCH', 'Source array token missing');
                node = node.elements[segment.index];
            }
        }
        return { start: node.getStart(source), end: node.getEnd() };
    };
}
