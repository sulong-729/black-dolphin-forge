import {ProjectRegistry} from '../projects/registry.js';
import {KitError} from '../contracts/errors.js';
export async function assertCurrentVersion(projects:ProjectRegistry,id:string,engineVersion:string) {
    const project=await projects.get(id);
    if(project.creatorVersion!==engineVersion)
        throw new KitError('CONFLICT','Project version changed; reconnect using its matching Creator adapter');
}
