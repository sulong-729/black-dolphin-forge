import path from 'node:path';
import { realpath, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readDocument } from '../daemon/read-document.js';
import { KitError } from '../contracts/errors.js';
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export interface SourceOwner {
    kind: 'project' | 'package' | 'engine';
    name: string;
    version: string | null;
    root: string;
}
export interface SourceFile {
    path: string;
    uri: string;
    text: string;
    hash: string;
    owner: SourceOwner;
}
export interface SourceCapture {
    root: string;
    options: SourceOptions;
    files: Map<string, SourceFile>;
    revision: string;
    engine: string;
    bytes: number;
}
export interface SourceOptions {
    creatorVersion: string;
    packages?: string[];
    engineRoot?: string;
    enginePaths?: string[];
}
export const within = (root: string, file: string) => { const rel = path.relative(root, file); return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
const slash = (p: string) => p.split(path.sep).join('/');
const relevant = (file: string) => /\.(?:[cm]?[jt]sx?|map|meta)$/.test(file) || /(?:^|[/\\])(?:tsconfig[^/\\]*\.json|package\.json)$/.test(file);
const ignored = new Set(['.git', '.superpowers', 'library', 'temp', 'build', 'dist', 'node_modules', '.venv']);
export async function captureSources(root: string, options: SourceOptions): Promise<SourceCapture> {
    root = await realpath(root);
    const owners: SourceOwner[] = [{ kind: 'project', name: 'project', version: null, root }], starts: {
        path: string;
        owner: SourceOwner;
    }[] = [];
    starts.push({ path: root, owner: owners[0] });
    for (const relative of options.packages ?? []) {
        const lexical = path.resolve(root, relative);
        if (path.isAbsolute(relative) || !within(root, lexical))
            throw new KitError('PATH_OUTSIDE_PROJECT', 'Package root escapes project');
        let canonical: string;
        try {
            canonical = await realpath(lexical);
        }
        catch {
            throw new KitError('NOT_FOUND', 'Package root not found');
        }
        if (!within(root, canonical))
            throw new KitError('PATH_OUTSIDE_PROJECT', 'Package symlink escapes registered project');
        let pkg: any = {};
        try {
            const packageFile = await realpath(path.join(canonical, 'package.json'));
            if (!within(canonical, packageFile))
                throw new KitError('PATH_OUTSIDE_PROJECT', 'Package metadata escapes selected root');
            pkg = JSON.parse((await readDocument(packageFile)).toString());
        }
        catch (error) {
            if (error instanceof KitError)
                throw error;
        }
        const owner: SourceOwner = { kind: 'package', name: typeof pkg.name === 'string' ? pkg.name : slash(relative), version: typeof pkg.version === 'string' ? pkg.version : null, root: canonical };
        owners.push(owner);
        starts.push({ path: canonical, owner });
    }
    let engine = 'not-selected';
    if (options.engineRoot) {
        const canonical = await realpath(options.engineRoot);
        const versionFile = path.join(canonical, 'cocos/core/global-exports.ts');
        const versionCanonical = await realpath(versionFile);
        if (!within(canonical, versionCanonical))
            throw new KitError('PATH_OUTSIDE_PROJECT', 'Engine version source escapes selected root');
        const versionText = (await readDocument(versionCanonical)).toString();
        const version = /\bconst\s+engineVersion\s*=\s*['"]([^'"]+)['"]/.exec(versionText)?.[1];
        if (version !== options.creatorVersion)
            throw new KitError('UNAVAILABLE_CAPABILITY', 'Selected engine source does not match project Creator version');
        engine = version + ':' + hash(versionText);
        const owner: SourceOwner = { kind: 'engine', name: 'cocos', version, root: canonical };
        owners.push(owner);
        for (const relative of options.enginePaths ?? ['cocos', 'exports']) {
            const lexical = path.resolve(canonical, relative);
            if (path.isAbsolute(relative) || !within(canonical, lexical))
                throw new KitError('PATH_OUTSIDE_PROJECT', 'Engine source path escapes selected engine');
            const resolved = await realpath(lexical);
            if (!within(canonical, resolved))
                throw new KitError('PATH_OUTSIDE_PROJECT', 'Engine source symlink escapes selected root');
            starts.push({ path: resolved, owner });
        }
        starts.push({ path: versionFile, owner });
    }
    const files = new Map<string, SourceFile>();
    let bytes = 0, entries = 0;
    const visited = new Set<string>();
    async function scan(file: string, owner: SourceOwner, depth: number) {
        if (depth > 64 || ++entries > 30000)
            throw new KitError('RESOURCE_LIMIT', 'Source inventory traversal budget exceeded');
        const canonical = await realpath(file);
        if (!within(owner.root, canonical))
            throw new KitError('PATH_OUTSIDE_PROJECT', 'Source symlink escapes permitted root');
        const info = await lstat(canonical);
        if (info.isDirectory()) {
            const key = owner.kind + owner.root + canonical;
            if (visited.has(key))
                return;
            visited.add(key);
            for (const entry of (await readdir(canonical, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
                if (entry.isDirectory() && ignored.has(entry.name))
                    continue;
                await scan(path.join(canonical, entry.name), owner, depth + 1);
            }
            return;
        }
        if (!relevant(canonical))
            return;
        if (!info.isFile())
            throw new KitError('UNSUPPORTED_OPERATION', 'Source must be a regular file');
        const text = (await readDocument(canonical)).toString('utf8');
        if (Buffer.byteLength(text) > 2 * 1024 * 1024)
            throw new KitError('RESOURCE_LIMIT', 'Individual source exceeds 2 MiB');
        const old = files.get(canonical);
        bytes += Buffer.byteLength(text) - (old ? Buffer.byteLength(old.text) : 0);
        if (files.size >= 6000 && !old || bytes > 16 * 1024 * 1024)
            throw new KitError('RESOURCE_LIMIT', 'Source inventory exceeds 6000 files /16 MiB');
        const uri = owner.kind === 'project' ? 'project://' + slash(path.relative(root, canonical)) : owner.kind + '://' + encodeURIComponent(owner.name) + '/' + slash(path.relative(owner.root, canonical));
        files.set(canonical, Object.freeze({ path: canonical, uri, text, hash: hash(text), owner: Object.freeze({ ...owner }) }));
    }
    for (const start of starts)
        await scan(start.path, start.owner, 0);
    const projectPackage = files.get(path.join(root, 'package.json'));
    if (projectPackage) {
        let pkg: any;
        try {
            pkg = JSON.parse(projectPackage.text);
        }
        catch {
            throw new KitError('SCHEMA_MISMATCH', 'Invalid project package.json');
        }
        if (typeof pkg.creator?.version === 'string' && pkg.creator.version !== options.creatorVersion)
            throw new KitError('UNAVAILABLE_CAPABILITY', 'Captured project Creator version differs from selected source version');
    }
    const revision = hash(JSON.stringify([...files.values()].map(f => [f.path, f.uri, f.hash, f.owner.version]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
    return { root, options: structuredClone(options), files, revision, engine, bytes };
}
