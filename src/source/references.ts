import ts from 'typescript';
import { location } from './locations.js';
import { KitError } from '../contracts/errors.js';
import { SourceIndex } from './typescript-index.js';
export function references(index: SourceIndex, id: string, member?: string) {
    const item = index.item(id);
    const symbol = index.canonical(member ? index.member(id, member).symbol : item.nameNode ? index.checker.getSymbolAtLocation(item.nameNode) : undefined);
    if (!symbol)
        return [];
    const result: any[] = [];
    let count = 0;
    const names = new Set([symbol.getName()]);
    for (const source of index.program.getSourceFiles()) {
        if (!index.capture.files.has(source.fileName))
            continue;
        const aliases = (node: ts.Node) => {
            if ((ts.isImportSpecifier(node) || ts.isImportClause(node) || ts.isExportSpecifier(node) || ts.isImportEqualsDeclaration(node)) && node.name && index.canonical(index.checker.getSymbolAtLocation(node.name)) === symbol)
                names.add(node.name.text);
            ts.forEachChild(node, aliases);
        };
        aliases(source);
    }
    for (const source of index.program.getSourceFiles()) {
        if (!index.capture.files.has(source.fileName))
            continue;
        const visit = (node: ts.Node) => {
            if (++count > 2000000)
                throw new KitError('RESOURCE_LIMIT', 'Source traversal budget');
            if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node) && ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node) && names.has(node.text) && index.canonical(index.checker.getSymbolAtLocation(node)) === symbol)
                result.push({ name: node.text, confidence: 'semantic-symbol', location: location(index.capture, node) });
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return result;
}
export function dynamicEdges(index: SourceIndex) {
    const result: any[] = [];
    for (const source of index.program.getSourceFiles()) {
        if (!index.capture.files.has(source.fileName))
            continue;
        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
                const name = node.expression.name.text, arg = node.arguments[0];
                if (arg && ['emit', 'on', 'once'].includes(name) && !ts.isStringLiteralLike(arg))
                    result.push({ reason: ts.isIdentifier(arg) ? 'dynamic-event-name' : 'computed-call-target', confidence: 'unknown', location: location(index.capture, node) });
                if (arg && ['getComponent', 'getComponentInChildren'].includes(name) && !ts.isStringLiteralLike(arg)) {
                    const symbol = ts.isIdentifier(arg) ? index.canonical(index.checker.getSymbolAtLocation(arg)) : undefined;
                    const constructor = !!symbol?.declarations?.some(d => ts.isClassDeclaration(d) || ts.isClassExpression(d));
                    if (!constructor)
                        result.push({ reason: 'dynamic-component-type', confidence: 'unknown', location: location(index.capture, node) });
                }
            }
            if (ts.isElementAccessExpression(node) && node.argumentExpression && !ts.isStringLiteralLike(node.argumentExpression) && !ts.isNumericLiteral(node.argumentExpression))
                result.push({ reason: 'computed-property-access', confidence: 'unknown', location: location(index.capture, node) });
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return result;
}
