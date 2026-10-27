import {cp,copyFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ProjectRegistry} from '../projects/registry.js';
import {creatorAdapter} from '../compatibility/versions.js';
import {KitError} from '../contracts/errors.js';
export async function installEditorBridge(state:string,projectId:string) {
    const project=await new ProjectRegistry(state).get(projectId),adapter=creatorAdapter(project.creatorVersion);
    const dest=path.join(project.root,adapter.extensionDirectory,'cocos-ai-bridge');
    // Do not overwrite user extensions or active bridge state.
    try{await lstat(dest);throw new KitError('CONFLICT','Bridge directory already exists; inspect before replacing');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    await mkdir(path.dirname(dest),{recursive:true});
    const parent=await import('node:fs/promises').then(fs=>fs.realpath(path.dirname(dest)));
    if(path.relative(project.root,parent).startsWith('..'))throw new KitError('PATH_OUTSIDE_PROJECT','Extension directory escapes project');
    await cp(fileURLToPath(new URL('../../extensions/cocos-ai-bridge',import.meta.url)),dest,{recursive:true,filter:source=>path.basename(source)!=='config.json'});
    if(adapter.family==='creator-2')await copyFile(path.join(dest,'package-2x.json'),path.join(dest,'package.json'));
    await writeFile(path.join(dest,'config.json'),JSON.stringify({projectId,endpoint:path.join(state,'endpoint.json')}),{mode:0o600});
    return {projectId,creatorVersion:adapter.version,adapter:adapter.family,directory:dest,restartEditor:true,write:adapter.version==='3.7.3'?'probe-required':'unavailable'};
}
