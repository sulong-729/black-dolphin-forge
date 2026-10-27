import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {readDocument} from '../daemon/read-document.js';
import {KitError} from '../contracts/errors.js';

export const creatorVersions = ['3.7.3', '3.6.3', '2.1.3', '2.4.15'] as const;
export type CreatorVersion = typeof creatorVersions[number];
export function creatorAdapter(version: string | null) {
    if (!creatorVersions.includes(version as CreatorVersion))
        throw new KitError('UNAVAILABLE_CAPABILITY', 'Supported Creator versions: ' + creatorVersions.join(', ') + '; project declares ' + (version ?? 'no version'));
    const legacy = version!.startsWith('2.');
    return {version: version as CreatorVersion, family: legacy ? 'creator-2' : 'creator-3',
        sceneExtension: legacy ? '.fire' : '.scene', extensionDirectory: legacy ? 'packages' : 'extensions',
        engineVersionFile: legacy ? 'predefine.js' : 'cocos/core/global-exports.ts',
        enginePaths: legacy ? ['cocos2d', 'extensions', 'predefine.js'] : ['cocos', 'exports']};
}

// Read current metadata, never infer an exact patch version from a scene format.
export async function detectCreatorVersion(root: string): Promise<string | null> {
    const versions: string[] = [];
    for (const name of ['package.json', 'project.json']) {
        let text: Buffer;
        try {
            const file = await realpath(path.join(root, name)), relative = path.relative(root, file);
            if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative))
                throw new KitError('PATH_OUTSIDE_PROJECT', 'Project version metadata escapes root');
            text = await readDocument(file, 1024 * 1024);
        } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue; throw e; }
        let data; try { data = JSON.parse(text.toString()); }
        catch { throw new KitError('SCHEMA_MISMATCH', 'Invalid ' + name); }
        const value = name === 'package.json' ? data?.creator?.version : data?.version;
        if (value === undefined || value === null) continue;
        if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value))
            throw new KitError('SCHEMA_MISMATCH', 'Invalid Creator version in ' + name);
        if (name === 'project.json' && !value.startsWith('2.')) continue;
        versions.push(value);
    }
    if (new Set(versions).size > 1)
        throw new KitError('CONFLICT', 'package.json and project.json declare different Creator versions');
    return versions[0] ?? null;
}
