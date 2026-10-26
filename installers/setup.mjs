import path from 'node:path';
import os from 'node:os';
import {readFile,access,symlink} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2),bundle=path.resolve(args[0]||'bundle');
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<16))throw Error('Node.js 22.16 or newer is required.');
const runtimeOnly=args.includes('--runtime-only');
if(!runtimeOnly&&!['darwin','win32'].includes(process.platform))throw Error('Installer supports macOS and Windows.');
const root=path.resolve(args.includes('--root')?args[args.indexOf('--root')+1]:process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'Black Dolphin Forge'):path.join(os.homedir(),'Applications/Black Dolphin Forge'));
const load=rel=>import(pathToFileURL(path.join(bundle,'dist',rel)).href);
const {verifyBundle,installBundle,installed}=await load('distribution/install.js');
const meta=await verifyBundle(bundle),launcher=path.join(root,'forge.mjs');
let current;try{current=await installed(root);}catch(e){if(e.code!=='ENOENT')throw e;}
let service,desktop,state;
if(!runtimeOnly){service=await load('service/control.js');desktop=await load('desktop/lifecycle.js');state=(await load('platform/paths.js')).platformPaths().state;}
const status=service?await service.controlService('status',launcher,state):null;
if(status?.registration&&(status.registration.label!==status.plan.label||status.registration.file!==status.plan.file))throw Error('Service ownership differs; inspect the existing installation.');
if(current?.version!==meta.version){
    if(desktop)await desktop.stopDesktop(state);
    if(status?.registration)await service.controlService('stop',launcher,state);
    else if(status?.daemon)throw Error('Stop the manually started daemon before installing.');
    await installBundle(bundle,root);
}
if(!runtimeOnly){
    if(!status.registration)await service.controlService('install',launcher,state);
    await service.controlService('start',launcher,state);
    const shortcut=path.join(os.homedir(),'Desktop',process.platform==='win32'?'Black Dolphin Forge.lnk':'Black Dolphin Forge.app');
    let exists=false;try{await access(shortcut);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!exists){
        if(process.platform==='darwin')await symlink(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),shortcut);
        else {const script=path.join(root,'versions',meta.version,'scripts/install-desktop.mjs'),r=spawnSync(process.execPath,[script,root],{stdio:'inherit'});if(r.status!==0)throw Error('Runtime installed; shortcut creation failed.');}
    }
    if(!args.includes('--no-open'))await desktop.startDesktop(state,launcher);
}
console.log(JSON.stringify({installed:true,version:meta.version,root,service:!runtimeOnly}));
