import path from 'node:path';
import os from 'node:os';
import {realpath,stat} from 'node:fs/promises';
import {readDocument} from '../daemon/read-document.js';
import {KitError} from '../contracts/errors.js';
import {creatorAdapter} from './versions.js';

export async function findCreator(version:string) {
    const adapter=creatorAdapter(version);
    const roots=(process.env.COCOS_CREATOR_INSTALL_ROOTS?.split(path.delimiter).filter(Boolean)??[]).concat(process.platform==='win32'?
        [path.join(process.env.ProgramFiles||'C:\\Program Files','CocosDashboard/resources/editors/Creator'),path.join(process.env.LOCALAPPDATA||os.homedir(),'CocosDashboard/resources/editors/Creator'),'C:\\CocosDashboard\\resources\\editors\\Creator','C:\\CocosDashboard\\resources.editors\\Creator']:
        ['/Applications/Cocos/Creator',path.join(os.homedir(),'Applications/Cocos/Creator')]);
    for(const root of roots){
        const home=path.join(root,version),resources=process.platform==='win32'?path.join(home,'resources'):path.join(home,'CocosCreator.app/Contents/Resources');
        const creator=process.platform==='win32'?path.join(home,'CocosCreator.exe'):path.join(home,'CocosCreator.app/Contents/MacOS/CocosCreator');
        const engineRoot=path.join(resources,adapter.family==='creator-2'?'engine':'resources/3d/engine');
        try{
            if(!(await stat(creator)).isFile())continue;
            const text=(await readDocument(path.join(engineRoot,adapter.engineVersionFile))).toString();
            const actual=/\b(?:const|let|var)\s+engineVersion\s*=\s*['"]([^'"]+)['"]/.exec(text)?.[1];
            if(actual!==version)continue;
            return {creator:await realpath(creator),engineRoot:await realpath(engineRoot)};
        }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT'&&!(e instanceof KitError))throw e;}
    }
    throw new KitError('UNAVAILABLE_CAPABILITY','Creator '+version+' is not installed in the configured locations','Install the exact version through Cocos Dashboard, or configure explicit creator/engineRoot paths or COCOS_CREATOR_INSTALL_ROOTS. Project version is never upgraded automatically.');
}
