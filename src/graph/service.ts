import path from 'node:path';
import {z} from 'zod';
import {AssetIndex} from '../assets/index.js';
import {EntityRefSchema,KitError,type Registry,type RequestEnvelope} from '../contracts/index.js';
import {ProjectRegistry} from '../projects/registry.js';
import {SnapshotStore} from '../snapshots/store.js';
import {Formatter} from '../query/formatter.js';
import {readDocument} from '../daemon/read-document.js';
import {decode,GraphDocument,fingerprint} from './decode.js';
import {dryRunRestore} from './encode.js';
export function registerGraphs(registry:Registry,projects:ProjectRegistry,snapshots:SnapshotStore,formatter:Formatter){
 const id=(r:RequestEnvelope)=>{if(!r.projectId)throw new KitError('SCHEMA_MISMATCH','projectId required');return r.projectId;};
 const doc=(snapshot:string,r:RequestEnvelope)=>snapshots.resource(snapshot,{projectId:id(r),source:'disk'}) as GraphDocument;
 const add=(name:string,inputSchema:z.ZodType,handler:any)=>registry.register({name,area:'graph',process:'offline',readOnly:true,availability:'available',inputSchema,handler});
 add('graph.capture',z.object({path:z.string()}).strict(),async(p:{path:string},r:RequestEnvelope)=>{
  const project=await projects.get(id(r));if(project.creatorVersion!=='3.7.3')throw new KitError('UNAVAILABLE_CAPABILITY','Offline source format targets Creator 3.7.3 only');const file=await projects.resolve(project.id,p.path);if(!['.prefab','.scene'].includes(path.extname(file)))throw new KitError('SCHEMA_MISMATCH','Only source .prefab/.scene assets are supported');
  const raw=(await readDocument(file)).toString('utf8'),assets=await AssetIndex.scan(project.root),document='db://'+path.relative(project.root,file).split(path.sep).join('/');
  const graph=decode(raw,{project:project.id,source:'disk',document,session:null,creatorVersion:project.creatorVersion},{assets});
  if(fingerprint((await readDocument(file)).toString())!==graph.view.revision)throw new KitError('STALE_REVISION','Document changed during graph capture');
  const snapshot=snapshots.capture({projectId:project.id,source:'disk',document,session:null,revision:{data:graph.view.revision,schema:'cocos-source-graph-v1',engine:'3.7.3-unqualified-generic-writer',assets:assets.revision,sourceIndex:'not-indexed'},data:graph.view.entities,warnings:graph.view.findings.map(f=>f.code+': '+f.message)}, {resource:graph,bytes:graph.retainedBytes});
  return {snapshot:snapshot.id,roots:graph.view.roots,coverage:graph.view.coverage,findings:graph.view.findings.length,revision:snapshot.revision};
 });
 const summary=(e:GraphDocument['view']['entities'][number])=>({handle:e.ref.handle,path:e.ref.path,kind:e.kind,type:e.type,...e.name!==undefined?{name:e.name,activeSelf:e.activeSelf,activeInHierarchy:e.activeInHierarchy}:{},children:e.children?.length??0,components:e.components?.map(ref=>ref.component?.type)||[],fields:Object.keys(e.properties),orphan:e.orphan});
 add('graph.query',z.object({snapshot:z.string(),kind:z.enum(['nodes','components','records','all']).default('nodes'),projection:z.enum(['summary','full']).default('summary'),limit:z.number().int().min(1).max(50).optional(),depth:z.number().int().nonnegative().max(32).default(2),cursor:z.string().optional()}).strict(),(p:any,r:RequestEnvelope)=>{
  const document=doc(p.snapshot,r);const all=document.view.entities;const byHandle=new Map(all.map(e=>[e.ref.handle,e]));const items=all.filter(e=>{
   if(p.kind==='nodes'&&e.kind!=='node'||p.kind==='components'&&e.kind!=='component'||p.kind==='records'&&!['record','storage'].includes(e.kind))return false;
   if(p.kind==='nodes'){let level=0,parent=e.parent;const seen=new Set<string>();while(parent){if(seen.has(parent.handle))return true;seen.add(parent.handle);level++;parent=byHandle.get(parent.handle)?.parent;}if(level>p.depth)return false;}
   return true;
  }).map(e=>p.projection==='full'?e:summary(e));
  const result=formatter.page({...p,projectId:id(r)},{key:JSON.stringify(['graph',p.kind,p.projection,p.depth]),items});return {...result,projection:p.projection,omittedEntities:all.length-items.length};
 });
 add('graph.resolve',z.object({snapshot:z.string(),target:z.union([EntityRefSchema,z.string()])}).strict(),(p:any,r:RequestEnvelope)=>{const entity=doc(p.snapshot,r).resolve(p.target);return {...summary(entity),ref:entity.ref,coverage:entity.coverage};});
 add('graph.inspect',z.object({snapshot:z.string(),target:z.union([EntityRefSchema,z.string()]),fields:z.array(z.string()).max(100).optional(),cursor:z.string().optional()}).strict(),(p:any,r:RequestEnvelope)=>{
  const entity=doc(p.snapshot,r).resolve(p.target);if(p.fields?.some((f:string)=>!Object.hasOwn(entity.properties,f)))throw new KitError('SCHEMA_MISMATCH','Unknown serialized field');const properties=p.fields?Object.fromEntries(p.fields.map((f:string)=>[f,entity.properties[f]])):entity.properties;
  return formatter.page({snapshot:p.snapshot,projectId:id(r),limit:1,cursor:p.cursor},{key:JSON.stringify(['inspect',entity.ref.handle,p.fields??null]),items:[{...entity,properties}]});
 });
 add('graph.restore',z.object({snapshot:z.string(),patches:z.array(z.unknown()).max(100)}).strict(),(p:any,r:RequestEnvelope)=>{const document=doc(p.snapshot,r);const result=dryRunRestore(document,p.patches);return {text:result.text.slice(0,6000),total:result.text.length,nextOffset:result.text.length>6000?6000:null,changes:result.changes,engineQualified:false};});
 add('graph.original',z.object({snapshot:z.string(),offset:z.number().int().nonnegative().default(0)}).strict(),(p:any,r:RequestEnvelope)=>{const raw=doc(p.snapshot,r).original();if(p.offset>raw.length)throw new KitError('SCHEMA_MISMATCH','Offset outside source artifact');return {text:raw.slice(p.offset,p.offset+6000),nextOffset:p.offset+6000<raw.length?p.offset+6000:null,total:raw.length};});
 registry.register({name:'graph.apply',area:'graph',process:'offline',readOnly:false,availability:'unavailable',inputSchema:z.object({snapshot:z.string()}).strict()});
}
