import { readFile, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export async function within(root:string,file:string):Promise<string>{
 const base=await realpath(root),candidate=path.resolve(base,file);
 const inside=(p:string)=>{const r=path.relative(base,p);return r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
 let absolute:string;
 try{absolute=await realpath(candidate);}catch(error){if(!inside(candidate))throw new Error('Path outside project');throw error;}
 if(!inside(absolute))throw new Error('Path outside project');
 return absolute;
}
export async function project(root:string){
 root=await realpath(root);const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 if(!pkg.creator?.version)throw new Error('Not a Cocos Creator project: missing creator.version');
 return {id:hash(root).slice(0,16),root,creatorVersion:String(pkg.creator.version)};
}
export async function* walk(root:string,dir:string=path.join(root,'assets')):AsyncGenerator<string>{
 let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{return;}
 for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
  if(['node_modules','library','temp','build','.git','.cocos-ai'].includes(entry.name))continue;
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())yield* walk(root,file);
  else if(entry.isFile())yield file;
  // Never follow symlinks while indexing assets; direct reads use realpath containment.
 }
}
