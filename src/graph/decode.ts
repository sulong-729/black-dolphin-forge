import {randomUUID,createHash} from 'node:crypto';
import {KitError} from '../contracts/errors.js';
import type {EntityRef,Value} from '../contracts/index.js';
import {identities} from './identities.js';
import {Payloads} from './opaque.js';
import type {Graph,GraphContext,GraphOptions,NativeRecord,Entity} from './types.js';
export const fingerprint=(s:string)=>createHash('sha256').update(s).digest('hex');
export const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const child of Object.values(v))freeze(child);}return v;}
const storageFields=new Set(['__type__','_id','__editorExtras__']);
export class GraphDocument {
 readonly view:Graph;
 #dependencyBaseline:Readonly<Record<string,string>>;#inventoryBaseline:string|undefined;
 #raw:string;#payloads:Payloads;#data:NativeRecord[];#slots:Map<number,Entity>;#options:GraphOptions;
 constructor(raw:string,context:GraphContext,options:GraphOptions={}){
  if(context.source!=='disk'||context.session!==null)throw new KitError('PROCESS_MISMATCH','Offline decoder accepts disk documents only; runtime identities require a live adapter');
  let data:any;try{data=JSON.parse(raw);}catch{throw new KitError('SCHEMA_MISMATCH','Invalid serialized JSON');}
  if(!Array.isArray(data)||!data.length||data.length>100000||!data.every(v=>v&&typeof v==='object'&&!Array.isArray(v)))throw new KitError('SCHEMA_MISMATCH','Expected bounded Cocos source object array');
  if(Buffer.byteLength(raw)>32*1024*1024)throw new KitError('RESOURCE_LIMIT','Document exceeds 32 MiB');
  const depthStack:{value:any;depth:number}[]=[{value:data,depth:0}];while(depthStack.length){const {value,depth}=depthStack.pop()!;if(depth>192)throw new KitError('RESOURCE_LIMIT','Serialized JSON nesting exceeds supported depth');if(value&&typeof value==='object')for(const child of Object.values(value))if(child&&typeof child==='object')depthStack.push({value:child,depth:depth+1});}
  const unresolvedTypes=new Set<string>();
  const revision=fingerprint(raw),typeFor=(type:string)=>{try{const asset=options.assets?.resolveUuid(type);if(asset?.className)return asset.className;}catch{}if(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(type)||/^[0-9a-f]{2}[A-Za-z0-9+/]{20}$/.test(type)||/^[0-9a-f]{5}[A-Za-z0-9+/]{18}$/.test(type)){unresolvedTypes.add(type);return '<unresolved-class>';}return type;};
  const ids=identities(data,context,revision,typeFor),payloads=new Payloads();let unresolved=0,opaque=0;const snapshotId=randomUUID();if(unresolvedTypes.size)ids.findings.push({code:'UNRESOLVED_CLASS',path:'/',message:unresolvedTypes.size+' serialized class identities have no proven class name'});
  const refKeys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
  const invalidObjects=new WeakSet<object>();
  const mark=(value:object,path:string,code:string,message:string)=>{if(!invalidObjects.has(value)){invalidObjects.add(value);unresolved++;ids.findings.push({code,path,message});}};
  // Validate links independently of projection: opaque storage must not hide broken native references.
  for(const [slot,entity]of ids.slots){
   const record=data[slot];const stack:{value:any;path:string}[]=[{value:record,path:entity.ref.path}];
   while(stack.length){const {value,path}=stack.pop()!;if(!value||typeof value!=='object')continue;
    if(!Array.isArray(value)&&Object.hasOwn(value,'__id__')&&refKeys(value,['__id__'])){if(!Number.isInteger(value.__id__)||!ids.slots.has(value.__id__))mark(value,path,'UNRESOLVED_REF','Serialized object target missing or invalid');continue;}
    if(!Array.isArray(value)&&typeof value.__uuid__==='string'&&refKeys(value,['__uuid__','__expectedType__'])){try{if(value.__expectedType__!==undefined&&typeof value.__expectedType__!=='string')throw Error();if(!options.assets)throw Error();options.assets.resolveUuid(value.__uuid__,value.__expectedType__||null);}catch{mark(value,path,'UNRESOLVED_ASSET','Asset unresolved or importer type not proved');}continue;}
    for(const [key,child]of Object.entries(value))if(child&&typeof child==='object')stack.push({value:child,path:path+'/'+key});
   }
   const structural=(value:any,allowed:string[],label:string)=>{if(value===undefined||value===null)return;const target=Number.isInteger(value?.__id__)?ids.slots.get(value.__id__):undefined;if(!target||!allowed.includes(target.type))ids.findings.push({code:'STRUCTURAL_REFERENCE',path:entity.ref.path,message:label+' target is invalid'});};
   if(record.__type__==='cc.Prefab')structural(record.data,['cc.Node','cc.Scene'],'Prefab.data');
   if(entity.kind==='node'||entity.kind==='component')structural(record._prefab,['cc.PrefabInfo','cc.CompPrefabInfo'],'Prefab metadata');
   if(record.__type__==='cc.PrefabInfo')structural(record.root,['cc.Node','cc.Scene'],'Prefab root');
  }
  let expanded=0,valueCount=0;
  const charge=(amount:number)=>{expanded+=amount;if(expanded>32*1024*1024)throw new KitError('RESOURCE_LIMIT','Expanded typed graph exceeds projection budget');};
  const refCost=(ref:EntityRef)=>500+6*(ref.path.length+ref.project.length+ref.document.length);
  for(const e of ids.entities){charge(refCost(e.ref)+6*(e.name?.length||0));if(e.parent)charge(refCost(e.parent));for(const ref of [...e.children||[],...e.components||[]])charge(refCost(ref));}
  const convert=(value:any,path:string,depth=0):Value=>{
   if(++valueCount>500000)throw new KitError('RESOURCE_LIMIT','Typed value count budget exceeded');charge(80+(typeof value==='string'?6*value.length:0));
   if(depth>128){opaque++;return payloads.opaque(value,'deep-value');}
   if(value===null)return {kind:'null'};
   if(typeof value==='boolean')return {kind:'boolean',value};if(typeof value==='string')return {kind:'string',value};if(typeof value==='number'){if(Number.isFinite(value))return {kind:'number',value};opaque++;return payloads.opaque(value,'non-finite');}
   if(Array.isArray(value))return {kind:'array',elementType:'serialized',items:value.map((v,i)=>convert(v,path+'/'+i,depth+1))};
   if(Object.hasOwn(value,'__id__')&&refKeys(value,['__id__'])){const target=Number.isInteger(value.__id__)?ids.slots.get(value.__id__):undefined;if(target){charge(refCost(target.ref));return {kind:'ref',targetType:target.kind==='node'?'node':target.kind==='component'?'component':'record',target:target.ref};}mark(value,path,'UNRESOLVED_REF','Serialized object target missing');return payloads.unresolved(value,'record','Serialized object target missing');}
   if(typeof value.__uuid__==='string'&&refKeys(value,['__uuid__','__expectedType__'])){try{const asset=options.assets?.resolveUuid(value.__uuid__,value.__expectedType__||null);if(!asset)throw Error();return {kind:'asset-ref',target:{project:context.project,document:asset.document,subAsset:asset.subAsset,expectedType:value.__expectedType__||null}};}catch{mark(value,path,'UNRESOLVED_ASSET','Asset unresolved or importer type not proved');return payloads.unresolved(value,value.__expectedType__||'cc.Asset','Asset unresolved or importer type not proved');}}
   const type=typeof value.__type__==='string'?value.__type__:'Object';
   if(type!=='Object'&&!['cc.Vec2','cc.Vec3','cc.Vec4','cc.Quat','cc.Color','cc.Size','cc.Rect','cc.Mat3','cc.Mat4'].includes(type)){opaque++;return payloads.opaque(value,type);}
   return {kind:'value',type,fields:Object.fromEntries(Object.entries(value).filter(([k])=>k!=='__type__').map(([k,v])=>[k,convert(v,path+'/'+k,depth+1)]))};
  };
  for(const [slot,e] of ids.slots){const record=data[slot];const skip=new Set(storageFields);if(e.kind==='node')for(const k of ['_name','_parent','_children','_components','_prefab'])skip.add(k);if(e.kind==='component'){skip.add('node');skip.add('_prefab');try{const asset=options.assets?.resolveUuid(record.__type__);if(asset?.className)e.script={document:asset.document};}catch{}}
   if(e.kind==='storage'){opaque++;e.properties.payload=payloads.opaque(record,e.type);}else for(const [k,value]of Object.entries(record))if(!skip.has(k))e.properties[k]=convert(value,e.ref.path+'/'+k);
   if(/^cc\.(PrefabInstance|PropertyOverrideInfo|TargetOverrideInfo|TargetInfo)$/.test(e.type))ids.findings.push({code:'UNSUPPORTED_PREFAB',path:e.ref.path,message:'Override metadata preserved, effective values/write not qualified'});
   if(record._prefab?.__id__!==undefined){const meta=data[record._prefab.__id__];if(meta?.asset)convert(meta.asset,e.ref.path+'/@prefab-source');}
  }
  const reached=new Set<number>(),pending:number[]=[];for(let i=0;i<data.length;i++)if(['cc.Prefab','cc.SceneAsset'].includes(data[i].__type__))pending.push(i);if(!pending.length)for(const slot of ids.rootSlots)pending.push(slot);
  while(pending.length){const i=pending.pop()!;if(reached.has(i)||!data[i])continue;reached.add(i);const stack:any[]=[data[i]];while(stack.length){const v=stack.pop();if(!v||typeof v!=='object')continue;if(Object.keys(v).length===1&&Number.isInteger(v.__id__)){pending.push(v.__id__);continue;}for(const child of Object.values(v))stack.push(child);}}
  for(const [slot,e]of ids.slots)e.orphan=!reached.has(slot);
  for(const finding of options.assets?.findings||[])ids.findings.push({...finding});
  this.#dependencyBaseline=freeze({...options.assets?.fingerprints});this.#inventoryBaseline=options.assets?.inventoryRevision;
  this.#payloads=payloads;this.#raw=raw;this.#data=data;this.#slots=ids.slots;this.#options={...options,schemas:options.schemas?freeze(structuredClone(options.schemas)):undefined};
  this.view=freeze({formatVersion:1,snapshotId,context:{...context},revision,assetRevision:options.assets?.revision||'not-indexed',roots:ids.roots,entities:ids.entities,findings:ids.findings,coverage:{totalRecords:data.length,unresolved,opaque,integrity:!ids.findings.some(f=>['HIERARCHY_CYCLE','INVALID_PARENT','INVALID_CHILDREN','INVALID_COMPONENT','COMPONENT_OWNER','CHILD_PARENT_MISMATCH','PATH_COLLISION','STRUCTURAL_REFERENCE'].includes(f.code)),write:false,engineQualified:false}});
 }
 get retainedBytes(){return Buffer.byteLength(this.#raw)+Buffer.byteLength(JSON.stringify(this.#data))+Buffer.byteLength(JSON.stringify(this.view))+this.#payloads.bytes+(this.#options.assets?.retainedBytes||0);}
 opaque(handle:string){return this.#payloads.read(handle);}
 original(){return this.#raw;}
 resolve(target:EntityRef|string):Entity{if(typeof target==='string'){const exact=this.view.entities.filter(e=>e.ref.path===target);const matches=exact.length?exact:this.view.entities.filter(e=>e.name===target);if(matches.length>1)throw new KitError('AMBIGUOUS_TARGET','Target path/name is ambiguous');if(!matches.length)throw new KitError('NOT_FOUND','Graph target not found');return matches[0];}
  if(target.project!==this.view.context.project)throw new KitError('FOREIGN_PROJECT','Reference belongs to another project');const found=this.view.entities.find(e=>equal(e.ref,target));if(!found)throw new KitError('STALE_HANDLE','Reference does not belong to this exact document/session/snapshot');return found;
 }
 // Server-side codec internals. Never expose native slots/raw map as client-editable input.
 nativeSlot(ref:EntityRef){this.resolve(ref);return [...this.#slots].find(([,e])=>e.ref.handle===ref.handle)![0];}
 nativeRecords(){return structuredClone(this.#data);}
 schema(type:string){return this.#options.schemas?.[type];}
 get inventoryRevision(){return this.#inventoryBaseline;}
 dependencies(){return this.#dependencyBaseline;}
 assets(){return this.#options.assets;}
}
export const decode=(raw:string,context:GraphContext,options:GraphOptions={})=>new GraphDocument(raw,context,options);
