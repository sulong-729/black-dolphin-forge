import ts from 'typescript';
import type { SourceCapture } from './roots.js';
import { KitError } from '../contracts/errors.js';
export function location(capture: SourceCapture, node: ts.Node) {
    const source = node.getSourceFile(), file = capture.files.get(source.fileName);
    if (!file)
        throw new KitError('PATH_OUTSIDE_PROJECT', 'Symbol declaration outside captured roots');
    const start = node.getStart(source), end = node.getEnd(), a = source.getLineAndCharacterOfPosition(start), b = source.getLineAndCharacterOfPosition(end);
    return { uri: file.uri, path: file.path, hash: file.hash, owner: file.owner, range: { start: { line: a.line + 1, column: a.character + 1, offset: start }, end: { line: b.line + 1, column: b.character + 1, offset: end } }, kind: source.isDeclarationFile ? 'declaration' : /\.[cm]?jsx?$/.test(file.path) && (/\.min\.[cm]?js$/.test(file.path) || /sourceMappingURL=/.test(file.text) || file.text.split('\n').some(line => line.length > 1000)) ? 'compiled-or-minified' : /\.[cm]?jsx?$/.test(file.path) ? 'javascript-source' : 'implementation', sourceIndexRevision: capture.revision };
}
