import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.test.mjs')?[path.join(dir,e.name)]:[]))).flat();}
const child=spawn(process.execPath,['--test',...(await files('tests')).sort()],{stdio:'inherit',windowsHide:true});child.on('error',e=>{console.error(e);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
