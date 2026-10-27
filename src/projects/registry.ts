import {detectCreatorVersion} from '../compatibility/versions.js';
import path from 'node:path';
import { mkdir, realpath, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
export interface Project {
    id: string;
    root: string;
    creatorVersion: string | null;
}
export class ProjectRegistry {
    private queue: Promise<unknown> = Promise.resolve();
    constructor(readonly state: string) { }
    private async load(): Promise<Project[]> { try {
        return JSON.parse(await readFile(path.join(this.state, 'projects.json'), 'utf8'));
    }
    catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT')
            return [];
        throw e;
    } }
    async list() { await this.queue; return Promise.all((await this.load()).map(async p => ({...p, creatorVersion: await detectCreatorVersion(p.root)}))); }
    async register(root: string): Promise<Project> {
        const task = this.queue.then(async () => {
            const canonical = await realpath(root);
            if (!(await stat(canonical)).isDirectory())
                throw new KitError('SCHEMA_MISMATCH', 'Project root must be a directory');
            const id = createHash('sha256').update(process.platform === 'win32' ? canonical.toLowerCase() : canonical).digest('hex').slice(0, 24);
            const entries = await this.load();
            const existing = entries.find(x => x.id === id);
            const creatorVersion = await detectCreatorVersion(canonical);
            if (existing)
                return {...existing, creatorVersion};
            const result = { id, root: canonical, creatorVersion };
            entries.push(result);
            await mkdir(this.state, { recursive: true, mode: 0o700 });
            const tmp = path.join(this.state, 'projects-' + randomUUID() + '.tmp');
            await writeFile(tmp, JSON.stringify(entries), { mode: 0o600 });
            await rename(tmp, path.join(this.state, 'projects.json'));
            return result;
        });
        this.queue = task.catch(() => { });
        return task;
    }
    async get(id: string) { await this.queue; const p = (await this.load()).find(x => x.id === id); if (!p)
        throw new KitError('FOREIGN_PROJECT', 'Project not registered'); return {...p,creatorVersion:await detectCreatorVersion(p.root)}; }
    async resolve(id: string, relative: string) { const project = await this.get(id); const candidate = path.resolve(project.root, relative); const inside = (p: string) => { const rel = path.relative(project.root, p); return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); }; if (!inside(candidate))
        throw new KitError('PATH_OUTSIDE_PROJECT', 'Path escapes project'); let resolved: string; try {
        resolved = await realpath(candidate);
    }
    catch {
        throw new KitError('NOT_FOUND', 'Project file not found');
    } if (!inside(resolved))
        throw new KitError('PATH_OUTSIDE_PROJECT', 'Symlink escapes project'); return resolved; }
}
