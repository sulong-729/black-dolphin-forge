import {readFile,writeFile,rename,unlink,open,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assetIndex,expandUuid,type Index} from './assets.js';
import {within,project,hash} from './project.js';
type Obj=Record<string,any>;
export interface ComponentUI{path:string;type:string;script?:string;properties:Obj}
export interface NodeUI{path:string;name:string;activeSelf:boolean;activeInHierarchy:boolean;properties:Obj;components:ComponentUI[]}
export interface UI{format:'cocos-ui/1';snapshotId:string;source:string;creatorVersion:string;complete:boolean;warnings:string[];nodes:NodeUI[];records:ComponentUI[]}
export interface Mapping{format:'cocos-map/1';snapshotId:string;root:string;source:string;revision:string;raw:string;baseline:UI;locators:Record<string,number>;assets:Record<string,Obj>;dependencies:Record<string,string>}
const nodeSkip=new Set(['__type__','_name','_active','_parent','_children','_components','_prefab','_id','__editorExtras__']);
const componentSkip=new Set(['__type__','node','_prefab','_id','__editorExtras__']);
const recordSkip=new Set(['__type__','_id','fileId','uuid','__editorExtras__']);
const escape=(name:string)=>name.replace(/~/g,'~0').replace(/\//g,'~1').replace(/\[/g,'~2').replace(/\]/g,'~3').replace(/#/g,'~4');
const plain=(value:any)=>value&&typeof value==='object'&&!Array.isArray(value);
function equal(a:any,b:any):boolean{return JSON.stringify(a)===JSON.stringify(b);}
function identity(ui:UI){return {format:ui.format,snapshotId:ui.snapshotId,source:ui.source,creatorVersion:ui.creatorVersion,complete:ui.complete,warnings:ui.warnings,nodes:ui.nodes.map(n=>({path:n.path,name:n.name,activeInHierarchy:n.activeInHierarchy,components:n.components.map(c=>({path:c.path,type:c.type,script:c.script}))})),records:ui.records.map(c=>({path:c.path,type:c.type,script:c.script}))};}
export async function exportUI(root:string,file:string):Promise<{ui:UI;map:Mapping}>{
 const p=await project(root);file=await within(p.root,file);
 if(!['.prefab','.scene'].includes(path.extname(file)))throw new Error('Only .prefab and .scene UI assets are supported');
 const raw=await readFile(file,'utf8'),data=JSON.parse(raw);
 if(!Array.isArray(data)||!data.every(x=>plain(x)))throw new Error('Unsupported Cocos serialization: expected object array');
 const index=await assetIndex(p.root),warnings:string[]=[],locators:Record<string,number>={},byIndex=new Map<number,{kind:string;path:string}>();
 const addWarning=(message:string)=>{if(!warnings.includes(message))warnings.push(message);};
 const paths=new Map<number,string>();
 const nodeIds=data.flatMap((o:Obj,i:number)=>['cc.Node','cc.Scene'].includes(o.__type__)?[i]:[]);
 function nodePath(i:number,visited=new Set<number>()):string{
  if(paths.has(i))return paths.get(i)!;
  if(visited.has(i)){addWarning('Cycle in node hierarchy');return '/!cycle-'+i;}
  visited.add(i);const node=data[i],parent=node._parent?.__id__;
  if(parent!==undefined&&!nodeIds.includes(parent))addWarning(`Invalid parent reference on ${node._name}`);
  const siblings=nodeIds.filter((j:number)=>data[j]._parent?.__id__===parent&&data[j]._name===node._name);
  let segment=escape(String(node._name||'(unnamed)'));if(siblings.length>1)segment+=`[${siblings.indexOf(i)}]`;
  const result=(nodeIds.includes(parent)?nodePath(parent,visited):'')+'/'+segment;paths.set(i,result);return result;
 }
 const register=(id:number,kind:string,locator:string)=>{if(Object.hasOwn(locators,locator))addWarning(`Duplicate locator: ${locator}`);locators[locator]=id;byIndex.set(id,{kind,path:locator});};
 for(const i of nodeIds)register(i,'$node',nodePath(i));
 const typeFor=(o:Obj)=>o.__type__?.startsWith('cc.')||o.__type__?.startsWith('sp.')?o.__type__ : index.byUuid.get(expandUuid(o.__type__||''))?.className || o.__type__;
 const components=new Map<number,ComponentUI[]>();
 for(const i of nodeIds){
  const counts=new Map<string,number>(),list:ComponentUI[]=[];
  for(const ref of data[i]._components||[]){
   const id=ref.__id__,o=data[id];if(!o){addWarning(`Missing component on ${nodePath(i)}`);continue;}
   const asset=index.byUuid.get(expandUuid(o.__type__||'')),type=typeFor(o),ordinal=counts.get(type)||0;counts.set(type,ordinal+1);
   const locator=`${nodePath(i)}#${escape(String(type))}[${ordinal}]`;register(id,'$component',locator);
   list.push({path:locator,type:asset?.className||o.__type__,...(asset?{script:asset.uri}:{}),properties:{}});
   if(!String(type).startsWith('cc.')&&!String(type).startsWith('sp.')&&!asset?.className)addWarning(`Unresolved component class at ${locator}`);
  }components.set(i,list);
 }
 const records:ComponentUI[]=[],recordCounts=new Map<string,number>();
 for(let i=0;i<data.length;i++){
  const o=data[i];if(byIndex.has(i)||['cc.Prefab','cc.SceneAsset','cc.PrefabInfo','cc.CompPrefabInfo'].includes(o.__type__))continue;
  const type=String(o.__type__||'Object'),n=recordCounts.get(type)||0;recordCounts.set(type,n+1);
  const locator=`/records/${escape(type)}[${n}]`;register(i,'$record',locator);records.push({path:locator,type,properties:{}});
 }
 const unsupported=data.some((o:Obj)=>/PrefabInstance|PropertyOverride|TargetOverride|TargetInfo/.test(o.__type__||''));
 if(unsupported)addWarning('Unsupported prefab override/target metadata: read-only; round-trip mutation blocked');
 const assets:Record<string,Obj>={};
 function encode(value:any):any{
  if(Array.isArray(value))return value.map(encode);if(!plain(value))return value;
  if(Object.hasOwn(value,'__id__')){
   const target=byIndex.get(value.__id__);if(target)return {[target.kind]:target.path};
   addWarning('Unresolved serialized object reference');return {$unresolved:'object-reference'};
  }
  if(Object.hasOwn(value,'__uuid__')){
   const asset=index.byUuid.get(expandUuid(value.__uuid__));
   if(asset){assets[asset.uri]={uuid:value.__uuid__,importer:asset.importer};return {$asset:asset.uri,...(value.__expectedType__?{expectedType:value.__expectedType__}:{})};}
   addWarning('Unresolved asset reference');return {$unresolved:'asset-reference',...(value.__expectedType__?{expectedType:value.__expectedType__}:{})};
  }
  return Object.fromEntries(Object.entries(value).filter(([key])=>!['_id','fileId','uuid'].includes(key)).map(([key,v])=>[key,encode(v)]));
 }
 const properties=(o:Obj,skip:Set<string>)=>Object.fromEntries(Object.entries(o).filter(([key])=>!skip.has(key)).map(([key,value])=>[key,encode(value)]));
 function active(i:number,seen=new Set<number>()):boolean{if(seen.has(i))return false;seen.add(i);const parent=data[i]._parent?.__id__;return data[i]._active!==false&&(!nodeIds.includes(parent)||active(parent,seen));}
 const nodes:NodeUI[]=nodeIds.map((i:number)=>{
  const comps=components.get(i)!;for(const c of comps)c.properties=properties(data[locators[c.path]],componentSkip);
  return {path:nodePath(i),name:String(data[i]._name||''),activeSelf:data[i]._active!==false,activeInHierarchy:active(i),properties:properties(data[i],nodeSkip),components:comps};
 });
 for(const record of records)record.properties=properties(data[locators[record.path]],recordSkip);
 const revision=hash(raw),snapshotId=randomUUID();
 const ui:UI={format:'cocos-ui/1',snapshotId,source:'db://'+path.relative(p.root,file).split(path.sep).join('/'),creatorVersion:p.creatorVersion,complete:!warnings.length,warnings,nodes,records};
 if(index.warnings.length){ui.complete=false;ui.warnings.push(...index.warnings);}
 const map:Mapping={format:'cocos-map/1',snapshotId,root:p.root,source:file,revision,raw,baseline:structuredClone(ui),locators,assets,dependencies:{...index.dependencies,[file]:revision}};
 return {ui,map};
}
export function restoreUI(ui:UI,map:Mapping):{text:string;changes:string[]}{
 if(map.format!=='cocos-map/1'||ui.snapshotId!==map.snapshotId)throw new Error('Snapshot/map mismatch');
 if(hash(map.raw)!==map.revision)throw new Error('Corrupt source map');
 if(!equal(identity(ui),identity(map.baseline)))throw new Error('Structural/read-only metadata edits are not supported');
 if(equal(ui,map.baseline))return {text:map.raw,changes:[]};
 if(!map.baseline.complete)throw new Error('Incomplete/unsupported references: mutation blocked');
 const data:Obj[]=JSON.parse(map.raw),changes:string[]=[];
 function decode(value:any,original:any,where:string):any{
  if(plain(value)&&Object.hasOwn(value,'$unresolved'))throw new Error('Unresolved reference at '+where);
  if(plain(value))for(const kind of ['$node','$component','$record'])if(Object.hasOwn(value,kind)){
   if(!plain(original)||!Object.hasOwn(original,'__id__')||Object.keys(value).length!==1)throw new Error('Reference kind mismatch at '+where);
   const id=map.locators[value[kind]],target=data[id],prior=data[original.__id__];
   if(!target||!prior)throw new Error('Unknown reference path at '+where);
   const expectedKind=['cc.Node','cc.Scene'].includes(prior.__type__)?'$node':prior.node?.__id__!==undefined?'$component':'$record';
   if(kind!==expectedKind||(kind!=='$node'&&target.__type__!==prior.__type__))throw new Error('Reference type mismatch at '+where);
   return {...original,__id__:id};
  }
  if(plain(value)&&Object.hasOwn(value,'$asset')){
   if(!original?.__uuid__||Object.keys(value).some(k=>!['$asset','expectedType'].includes(k)))throw new Error('Asset reference type mismatch');
   const asset=map.assets[value.$asset];if(!asset)throw new Error('Unknown asset path; refresh/export to index it');
   if((value.expectedType||undefined)!==(original.__expectedType__||undefined))throw new Error('Asset expectedType is read-only');
   const before=Object.values(map.assets).find(a=>a.uuid===original.__uuid__);
   if(asset.importer!==before?.importer)throw new Error('Asset importer mismatch');
   return {...original,__uuid__:asset.uuid};
  }
  if(Array.isArray(value)){
   if(!Array.isArray(original))throw new Error('Property type mismatch at '+where);
   if(value.length!==original.length)throw new Error('Array structural edits are not yet supported at '+where);
   return value.map((v,i)=>decode(v,original[i],where+'/'+i));
  }
  if(plain(value)){
   if(!plain(original))throw new Error('Property type mismatch at '+where);
   const expectedKeys=Object.keys(original).filter(k=>!['_id','fileId','uuid'].includes(k)).sort();
   if(!equal(Object.keys(value).sort(),expectedKeys))throw new Error('Property structural edits are not supported at '+where);
   const output={...original};for(const [key,v]of Object.entries(value)){if(key==='__type__'&&v!==original[key])throw new Error('Value type is read-only');output[key]=decode(v,original[key],where+'/'+key);}return output;
  }
  if((original!==null&&typeof original==='object')||typeof value!==typeof original||(typeof value==='number'&&!Number.isFinite(value)))throw new Error('Property type mismatch at '+where);
  return value;
 }
 function patch(record:ComponentUI|NodeUI,baseline:ComponentUI|NodeUI){
  const id=map.locators[record.path],raw=data[id];
  if(!equal(Object.keys(record.properties).sort(),Object.keys(baseline.properties).sort()))throw new Error('Property structural edits are not supported');
  for(const [key,value]of Object.entries(record.properties))if(!equal(value,baseline.properties[key])){raw[key]=decode(value,raw[key],record.path+'/'+key);changes.push(record.path+'/'+key);}
 }
 for(let i=0;i<ui.nodes.length;i++){
  const node=ui.nodes[i],base=map.baseline.nodes[i];patch(node,base);
  if(node.activeSelf!==base.activeSelf){if(typeof node.activeSelf!=='boolean')throw new Error('activeSelf must be boolean');data[map.locators[node.path]]._active=node.activeSelf;changes.push(node.path+'/activeSelf');}
  node.components.forEach((c,j)=>patch(c,base.components[j]));
 }
 ui.records.forEach((r,i)=>patch(r,map.baseline.records[i]));
 return {text:changes.length?JSON.stringify(data,null,2)+'\n':map.raw,changes};
}
export async function writeRestored(ui:UI,map:Mapping,options:{output?:string;apply?:boolean}):Promise<{output:string;changes:string[];backup?:string}>{
 const restored=restoreUI(ui,map);
 if(!options.apply&&!options.output)throw new Error('Specify separate --output or explicit --apply');
 if(options.apply&&options.output)throw new Error('Choose output or apply, not both');
 const source=await within(map.root,map.source);
 if(hash(await readFile(source,'utf8'))!==map.revision)throw new Error('Stale snapshot: source file changed');
 if(options.apply)for(const [file,fingerprint]of Object.entries(map.dependencies)){
  await within(map.root,file);if(hash(await readFile(file,'utf8'))!==fingerprint)throw new Error('Stale snapshot: metadata/script changed');
 }
 const output=path.resolve(options.apply?source:options.output!);
 if(!options.apply&&output===source)throw new Error('Use --apply to overwrite source');
 if(!options.apply){await writeFile(output,restored.text,{flag:'wx'});return {output,changes:restored.changes};}
 const lock=source+'.cocos-ai.lock',handle=await open(lock,'wx');let backup:string|undefined,temp:string|undefined;
 try{
  if(hash(await readFile(source,'utf8'))!==map.revision)throw new Error('Stale source under lock');
  if(!restored.changes.length)return {output,changes:[]};
  backup=source+'.cocos-ai-backup-'+randomUUID();await writeFile(backup,map.raw,{flag:'wx',mode:(await stat(source)).mode});
  temp=source+'.cocos-ai-tmp-'+randomUUID();await writeFile(temp,restored.text,{flag:'wx',mode:(await stat(source)).mode});
  if(hash(await readFile(source,'utf8'))!==map.revision)throw new Error('Source changed before apply');
  await rename(temp,source);temp=undefined;
  if(await readFile(source,'utf8')!==restored.text)throw new Error('Read-back verification failed');
  return {output,changes:restored.changes,backup};
 }finally{await handle.close();await unlink(lock).catch(()=>{});if(temp)await unlink(temp).catch(()=>{});}
}
