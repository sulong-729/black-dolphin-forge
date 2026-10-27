import ts from 'typescript';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
import type { SourceCapture } from './roots.js';
import { location } from './locations.js';
export interface IndexedClass {
    id: string;
    name: string;
    registered: string[];
    node: ts.ClassDeclaration | ts.ObjectLiteralExpression;
    nameNode?: ts.Node;
}
export class SourceIndex {
    readonly program: ts.Program;
    readonly checker: ts.TypeChecker;
    readonly classes: IndexedClass[] = [];
    readonly byId = new Map<string, IndexedClass>();
    readonly warnings: string[] = [];
    constructor(readonly capture: SourceCapture) {
        const files = capture.files;
        const directories = new Set<string>();
        for (const file of files.keys()) {
            let dir = path.dirname(file);
            while (!directories.has(dir)) {
                directories.add(dir);
                const parent = path.dirname(dir);
                if (parent === dir)
                    break;
                dir = parent;
            }
        }
        const scripts = [...files.keys()].filter(f => /\.[cm]?[jt]sx?$/.test(f));
        const host: ts.CompilerHost = { getSourceFile: (name, lang) => { const file = files.get(path.resolve(name)); return file && /\.[cm]?[jt]sx?$/.test(name) ? ts.createSourceFile(file.path, file.text, lang, true) : undefined; }, getDefaultLibFileName: () => '', writeFile: () => { throw new KitError('AUTHORIZATION_REQUIRED', 'Source index never writes'); }, getCurrentDirectory: () => capture.root, getDirectories: () => [], fileExists: file => files.has(path.resolve(file)), readFile: file => files.get(path.resolve(file))?.text, getCanonicalFileName: file => file, useCaseSensitiveFileNames: () => process.platform !== 'win32', getNewLine: () => '\n', directoryExists: dir => directories.has(path.resolve(dir)) };
        let config: ts.CompilerOptions = { allowJs: true, checkJs: false, noLib: true, skipLibCheck: true, experimentalDecorators: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Node10 };
        const configFile = files.get(path.join(capture.root, 'tsconfig.json'));
        if (configFile) {
            const parsed = ts.parseConfigFileTextToJson(configFile.path, configFile.text);
            if (parsed.error)
                this.warnings.push('Invalid tsconfig JSON');
            else {
                const parsedConfig = ts.parseJsonConfigFileContent(parsed.config, { useCaseSensitiveFileNames: process.platform !== 'win32', fileExists: host.fileExists, readFile: host.readFile, readDirectory: () => scripts }, capture.root);
                config = { ...config, ...parsedConfig.options };
                this.warnings.push(...parsedConfig.errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' ')));
            }
        }
        // Compiler plugins, emits and fallback disk reads are never used.
        config = { ...config, noLib: true, noEmit: true, plugins: undefined, types: [], typeRoots: [] };
        const resolutionCache = ts.createModuleResolutionCache(capture.root, host.getCanonicalFileName, config);
        const engineEntry = [...files.values()].find(f => f.owner.kind === 'engine' && path.relative(f.owner.root, f.path).split(path.sep).join('/') === 'exports/base.ts');
        host.resolveModuleNames = (names, containing) => names.map(name => name === 'cc' && engineEntry ? { resolvedFileName: engineEntry.path, extension: ts.Extension.Ts, isExternalLibraryImport: true } : ts.resolveModuleName(name, containing, config, host, resolutionCache).resolvedModule);
        this.program = ts.createProgram(scripts, config, host);
        this.checker = this.program.getTypeChecker();
        for (const source of this.program.getSourceFiles()) {
            if (!files.has(source.fileName))
                continue;
            const visit = (node: ts.Node) => {
                if (ts.isClassDeclaration(node) && node.name) {
                    const registered: string[] = [];
                    if (ts.canHaveDecorators(node))
                        for (const decorator of ts.getDecorators(node) ?? []) {
                            const exp = decorator.expression;
                            if (ts.isCallExpression(exp) && (ts.isIdentifier(exp.expression) && exp.expression.text === 'ccclass' || ts.isPropertyAccessExpression(exp.expression) && exp.expression.name.text === 'ccclass')) {
                                const arg = exp.arguments[0];
                                if (arg && ts.isStringLiteralLike(arg))
                                    registered.push(arg.text);
                            }
                        }
                    const id = createHash('sha256').update(JSON.stringify([capture.revision, source.fileName, node.getStart(source)])).digest('hex').slice(0, 32);
                    const item = { id, name: node.name.text, registered, node, nameNode: node.name };
                    this.classes.push(item);
                    this.byId.set(id, item);
                }
                if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(source)==='cc'&&node.expression.name.text==='Class'&&node.arguments.length===1&&ts.isObjectLiteralExpression(node.arguments[0])){
                    const object=node.arguments[0],named=object.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(source)==='name');
                    const name=named&&ts.isPropertyAssignment(named)&&ts.isStringLiteralLike(named.initializer)?named.initializer.text:path.basename(source.fileName).replace(/\.[^.]+$/,'');
                    const id=createHash('sha256').update(JSON.stringify([capture.revision,source.fileName,object.getStart(source)])).digest('hex').slice(0,32);
                    const item={id,name,registered:[name],node:object,nameNode:ts.isVariableDeclaration(node.parent)?node.parent.name:undefined};
                    this.classes.push(item);this.byId.set(id,item);
                    this.warnings.push('Legacy cc.Class factory indexed statically; generated members, dynamic registration and inheritance may be unresolved.');
                }
                ts.forEachChild(node, visit);
            };
            visit(source);
        }
    }
    resolve(target: string) {
        const found = this.byId.get(target);
        if (found)
            return this.describe(found);
        const registered = this.classes.filter(c => c.registered.includes(target));
        const matches = registered.length ? registered : this.classes.filter(c => c.name === target);
        if (matches.length !== 1)
            throw new KitError(matches.length ? 'AMBIGUOUS_TARGET' : 'NOT_FOUND', 'Class missing or ambiguous; use a returned class identity');
        return this.describe(matches[0]);
    }
    private describe(item: IndexedClass) { return { id: item.id, name: item.name, registered: item.registered, location: location(this.capture, item.node) }; }
    item(id: string) {
        const item = this.byId.get(id);
        if (!item)
            throw new KitError('STALE_HANDLE', 'Class identity not in this source revision');
        return item;
    }
    canonical(symbol: ts.Symbol | undefined): ts.Symbol | undefined {
        if (!symbol)
            return undefined;
        symbol = symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
        const roots = this.checker.getRootSymbols(symbol);
        return roots.length === 1 ? roots[0] : symbol;
    }
    member(id: string, name: string) {
        const item = this.item(id), type = this.checker.getTypeAtLocation(item.node), classSymbol = item.nameNode ? this.checker.getSymbolAtLocation(item.nameNode) : undefined, staticType = classSymbol ? this.checker.getTypeOfSymbolAtLocation(classSymbol, item.node) : undefined, symbol = this.checker.getPropertyOfType(type, name) || (staticType && this.checker.getPropertyOfType(staticType, name));
        if (!symbol)
            throw new KitError('NOT_FOUND', 'Member not found on class or base');
        const declarations = (symbol.getDeclarations() ?? []).filter(n => this.capture.files.has(n.getSourceFile().fileName));
        const implementation = declarations.find(n => ('body' in n) && !!n.body);
        const node = implementation ?? declarations[0];
        if (!node)
            throw new KitError('NOT_FOUND', 'Member declaration not in allowed source roots');
        return { symbol, node };
    }
    method(id: string, name: string) {
        const { node } = this.member(id, name);
        const initializer = ts.isPropertyDeclaration(node) || ts.isPropertyAssignment(node) ? node.initializer : undefined;
        const callable = ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || !!(initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)));
        const body = ts.isMethodDeclaration(node) ? node.body : initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) ? initializer.body : undefined;
        const loc = location(this.capture, node);
        return { class: id, member: name, status: !callable ? 'non-callable' : body && !node.getSourceFile().isDeclarationFile ? loc.kind === 'compiled-or-minified' ? 'compiled-implementation' : 'implementation' : 'declaration-only', location: loc, body: body ? location(this.capture, body) : null };
    }
    hierarchy(id: string) {
        const result: ReturnType<typeof this.describe>[] = [];
        const seen = new Set<ts.Type>();
        const walk = (type: ts.Type) => {
            if (seen.has(type))
                return;
            seen.add(type);
            if (seen.size > 100)
                throw new KitError('RESOURCE_LIMIT', 'Inheritance traversal budget');
            for (const base of type.isClassOrInterface() ? this.checker.getBaseTypes(type as ts.InterfaceType) ?? [] : []) {
                const declaration = base.symbol?.declarations?.find(ts.isClassDeclaration);
                const item = this.classes.find(c => c.node === declaration);
                if (item)
                    result.push(this.describe(item));
                walk(base);
            }
        };
        walk(this.checker.getTypeAtLocation(this.item(id).node));
        return result;
    }
    list() { return this.classes.map(item => this.describe(item)); }
}
