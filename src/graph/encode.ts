import {AssetIndex} from '../assets/index.js';
import {readDocument} from '../daemon/read-document.js';
import {sourceRanges} from './source-ranges.js';
import {readFile,open,unlink,realpath} from 'node:fs/promises';
import path from 'node:path';
import {KitError} from '../contracts/errors.js';
import {within} from '../project.js';
import {GraphDocument,fingerprint} from './decode.js';
import {patchRecords} from './patch.js';
export function dryRunRestore(doc:GraphDocument,steps:unknown[]){
 const {records,changes}=patchRecords(doc,steps);const raw=doc.original();if(!changes.length)return {text:raw,changes,sourceRevision:doc.view.revision,engineQualified:false};
 const locate=sourceRanges(raw);const replacements=changes.map(change=>{const slot=doc.nativeSlot(doc.resolve(change.target).ref);let value:any=records[slot];for(const segment of change.selector)value=value['field'in segment?segment.field:segment.index];return {...locate(slot,change.selector),text:JSON.stringify(value)};}).sort((a,b)=>b.start-a.start);
 let text=raw;for(const replacement of replacements)text=text.slice(0,replacement.start)+replacement.text+text.slice(replacement.end);if(Buffer.byteLength(text)>32*1024*1024)throw new KitError('RESOURCE_LIMIT','Restored source exceeds byte budget');
 return {text,changes,sourceRevision:doc.view.revision,engineQualified:false};
}
export async function writeSeparate(doc:GraphDocument,steps:unknown[],options:{root:string;source:string;output:string}){
 const source=await within(options.root,options.source);if(fingerprint((await readDocument(source)).toString())!==doc.view.revision)throw new KitError('STALE_REVISION','Source bytes changed');
 const relative='db://'+path.relative(await realpath(options.root),source).split(path.sep).join('/');if(relative!==doc.view.context.document)throw new KitError('FOREIGN_PROJECT','Source document does not match captured graph');
 if(doc.assets()){
  const current=await AssetIndex.scan(await realpath(options.root));if(current.inventoryRevision!==doc.inventoryRevision)throw new KitError('STALE_REVISION','Asset inventory changed after capture');
 }
 for(const [file,expected]of Object.entries(doc.dependencies())){
  try{const resolved=await within(options.root,file);if(fingerprint((await readDocument(resolved)).toString())===expected)continue;}catch{}
  throw new KitError('STALE_REVISION','Captured dependency changed after capture');
 }
 const result=dryRunRestore(doc,steps),output=path.resolve(options.output);let canonicalOutput:string;try{canonicalOutput=await realpath(output);}catch{canonicalOutput=path.join(await realpath(path.dirname(output)),path.basename(output));}if(canonicalOutput===source)throw new KitError('CONFLICT','Separate output cannot overwrite source');
 let handle;try{handle=await open(output,'wx',0o600);}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new KitError('CONFLICT','Output already exists');throw e;}
 try{await handle.writeFile(result.text);await handle.sync();await handle.close();handle=undefined;if(await readFile(output,'utf8')!==result.text)throw new KitError('INTEGRITY_ERROR','Output read-back mismatch');return {...result,output};}catch(error){await handle?.close().catch(()=>{});await unlink(output).catch(()=>{});throw error;}
}
export async function applyInPlace(_doc:GraphDocument,_steps:unknown[]):Promise<never>{throw new KitError('UNAVAILABLE_CAPABILITY','Native in-place writer is not engine/schema qualified; use dry-run or separate output');}
