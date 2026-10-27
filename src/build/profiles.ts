import {creatorVersions,creatorAdapter} from '../compatibility/versions.js';
import {findCreator} from '../compatibility/installations.js';
import {ProjectRegistry} from '../projects/registry.js';
import { z } from 'zod';
import { readFile, mkdir, writeFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { KitError } from '../contracts/errors.js';
export const profileSchema = z.object({ version: z.literal(1), creator: z.string().min(1), python: z.string().min(1), engineRoot: z.string().min(1), creatorVersion: z.enum(creatorVersions), target: z.literal('web-mobile'), scene: z.string().uuid(), debug: z.boolean().default(true), timeoutMs: z.number().int().min(1000).max(1800000).default(300000) }).strict();
export type BuildProfile = z.infer<typeof profileSchema>;
export async function configureBuild(state: string, projectId: string, value: unknown) { if (!/^[a-f0-9]{24}$/.test(projectId))
    throw new KitError('SCHEMA_MISMATCH', 'Invalid project id'); const supplied=profileSchema.partial({creator:true,engineRoot:true,creatorVersion:true}).parse(value);
    const project=await new ProjectRegistry(state).get(projectId),adapter=creatorAdapter(project.creatorVersion);
    if(supplied.creatorVersion&&supplied.creatorVersion!==adapter.version)throw new KitError('CONFLICT','Build version differs from detected project version');
    const discovered=(!supplied.creator||!supplied.engineRoot)?await findCreator(adapter.version):null;
    const p=profileSchema.parse({...discovered,...supplied,creatorVersion:adapter.version}); for (const key of ['creator', 'python'] as const) {
    if (!path.isAbsolute(p[key]))
        throw new KitError('SCHEMA_MISMATCH', 'Use absolute executable paths');
    p[key] = await realpath(p[key]);
    if (!(await stat(p[key])).isFile())
        throw new KitError('SCHEMA_MISMATCH', 'Executable must be a file');
} if (!path.isAbsolute(p.engineRoot))
    throw new KitError('SCHEMA_MISMATCH', 'Use absolute engine root'); p.engineRoot = await realpath(p.engineRoot); if (!(await stat(p.engineRoot)).isDirectory())
    throw new KitError('SCHEMA_MISMATCH', 'Engine root must be directory'); await mkdir(path.join(state, 'build-profiles'), { recursive: true, mode: 0o700 }); await writeFile(path.join(state, 'build-profiles', projectId + '.json'), JSON.stringify(p), { mode: 0o600 }); return p; }
export async function loadProfile(state: string, id: string) { try {
    return profileSchema.parse(JSON.parse(await readFile(path.join(state, 'build-profiles', id + '.json'), 'utf8')));
}
catch {
    throw new KitError('UNAVAILABLE_CAPABILITY', 'No valid local build profile', 'Configure Python and scene UUID through build configure CLI; Creator version is detected from the project. Optional creator/engineRoot paths must match that version.');
} }
