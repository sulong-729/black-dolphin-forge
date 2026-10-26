import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {hash,walk} from '../project.js';
import {readDocument} from '../daemon/read-document.js';
import {KitError} from '../contracts/errors.js';
import {expandUuid} from '../assets.js';
import {assetKey,importerCompatible,type IndexedAsset} from './subassets.js';
export {expandUuid};
export interface AssetFinding {code:string;path:string;message:string}
export class AssetIndex {
 readonly findings:AssetFinding[]=[];
 readonly fingerprints:Record<string,string>={};
 private capturedInventoryRevision='';
 get inventoryRevision(){return this.capturedInventoryRevision;}
 private byUuid=new Map<string,IndexedAsset[]>();
 private byPath=new Map<string,IndexedAsset[]>();
 private constructor(readonly root:string){}
 get retainedBytes(){return Buffer.byteLength(JSON.stringify([...this.byUuid]))+Buffer.byteLength(JSON.stringify([...this.byPath]))+Buffer.byteLength(JSON.stringify(this.fingerprints));}
 get complete(){return this.findings.length===0;}
 get revision(){return hash(JSON.stringify(Object.entries(this.fingerprints).sort()));}
 static async scan(root:string){
  root=await realpath(root);
  const result=new AssetIndex(root);const files=[];for await(const f of walk(root))files.push(f);
  const fileSet=new Set(files);
  for(const file of files){
   if(!file.endsWith('.meta')){if(!fileSet.has(file+'.meta'))result.findings.push({code:'MISSING_META',path:file,message:'Asset metadata is missing'});continue;}
   let meta:any;
   try {const bytes=await readDocument(file);result.fingerprints[file]=hash(bytes.toString());meta=JSON.parse(bytes.toString());if(!meta||typeof meta!=='object'||Array.isArray(meta)||typeof meta.uuid!=='string')throw Error('Expected metadata UUID');}
   catch {result.findings.push({code:'MALFORMED_META',path:file,message:'Invalid metadata or UUID'});continue;}
   const assetFile=file.slice(0,-5),document='db://'+path.relative(root,assetFile).split(path.sep).join('/');
   try{await stat(assetFile);}catch{result.findings.push({code:'MISSING_ASSET',path:assetFile,message:'Metadata has no corresponding asset'});continue;}
   let className:string|undefined;
   if(/\.[cm]?[jt]s$/.test(assetFile)){
    try{const source=(await readDocument(assetFile)).toString();result.fingerprints[assetFile]=hash(source);const ast=ts.createSourceFile(assetFile,source,ts.ScriptTarget.Latest,true);const names:string[]=[];
     function visit(node:ts.Node){if(ts.isClassDeclaration(node)&&ts.canHaveDecorators(node))for(const d of ts.getDecorators(node)||[]){const exp=d.expression;if(ts.isCallExpression(exp)&&((ts.isIdentifier(exp.expression)&&exp.expression.text==='ccclass')||(ts.isPropertyAccessExpression(exp.expression)&&exp.expression.name.text==='ccclass'))){const arg=exp.arguments[0];if(arg&&ts.isStringLiteral(arg))names.push(arg.text);}}ts.forEachChild(node,visit);}visit(ast);
     if(names.length===1)className=names[0];else if(names.length>1)result.findings.push({code:'AMBIGUOUS_CLASS',path:assetFile,message:'Multiple declared ccclasses require live registry qualification'});
    }catch{result.findings.push({code:'SCRIPT_UNREADABLE',path:assetFile,message:'Script cannot be read'});}
   }
   const add=(entry:any,keys:string[],depth:number)=>{
    if(depth>32||!entry||typeof entry!=='object'||typeof entry.uuid!=='string'){result.findings.push({code:'MALFORMED_META',path:file,message:'Invalid/deep subMeta'});return;}
    const asset:IndexedAsset={uuid:entry.uuid,document,subAsset:keys.length?keys.map(encodeURIComponent).join('/'):null,file:assetFile,importer:typeof entry.importer==='string'?entry.importer:null,...className?{className}:{}};
    const id=expandUuid(entry.uuid),existing=result.byUuid.get(id)||[];existing.push(asset);result.byUuid.set(id,existing);if(existing.length>1)result.findings.push({code:'DUPLICATE_UUID',path:file,message:'Conflicting UUID entries are ambiguous'});
    const k=assetKey(asset);result.byPath.set(k,[...(result.byPath.get(k)||[]),asset]);
    if(entry.subMetas!==undefined&&(!entry.subMetas||typeof entry.subMetas!=='object'||Array.isArray(entry.subMetas))){result.findings.push({code:'MALFORMED_META',path:file,message:'Invalid subMetas'});return;}
    for(const [key,value] of Object.entries(entry.subMetas||{}))add(value,[...keys,key],depth+1);
   };add(meta,[],0);
  }
  result.capturedInventoryRevision=result.revision;return result;
 }
 resolveUuid(uuid:string,expectedType:string|null=null){const candidates=this.byUuid.get(expandUuid(uuid));if(!candidates?.length)throw new KitError('NOT_FOUND','Asset UUID unresolved (including unindexed builtins)');if(candidates.length!==1)throw new KitError('AMBIGUOUS_TARGET','Conflicting asset UUID');const asset=candidates[0];if(!importerCompatible(asset.importer,expectedType))throw new KitError('SCHEMA_MISMATCH','Asset importer does not prove the expected type');return {...asset,expectedType};}
 resolvePath(ref:{document:string;subAsset:string|null;expectedType?:string|null}){const candidates=this.byPath.get(assetKey(ref));if(!candidates?.length)throw new KitError('NOT_FOUND','Asset path unresolved');if(candidates.length!==1)throw new KitError('AMBIGUOUS_TARGET','Conflicting asset path');return this.resolveUuid(candidates[0].uuid,ref.expectedType??null);}
 async dependencies(uuid:string){const seen=new Set<string>(),assets:IndexedAsset[]=[],edges:{from:string;to:string}[]=[],findings:AssetFinding[]=[];const pending=[uuid];
  while(pending.length){if(seen.size>=10000)throw new KitError('RESOURCE_LIMIT','Asset dependency budget exceeded');const id=expandUuid(pending.pop()!);if(seen.has(id))continue;seen.add(id);let asset:IndexedAsset;try{asset=this.resolveUuid(id);}catch(e){findings.push({code:(e as KitError).code,path:id,message:'Dependency unresolved'});continue;}assets.push(asset);
   if(!/\.(json|mtl|material|anim|font|prefab|scene)$/.test(asset.file))continue;
   let data:any;try{const bytes=await readDocument(asset.file);this.fingerprints[asset.file]=hash(bytes.toString());data=JSON.parse(bytes.toString());}catch{findings.push({code:'DEPENDENCY_UNREADABLE',path:asset.document,message:'Cannot inspect serialized dependency'});continue;}
   const stack=[data];while(stack.length){const value=stack.pop();if(!value||typeof value!=='object')continue;if(!Array.isArray(value)&&typeof value.__uuid__==='string'&&Object.keys(value).every(k=>['__uuid__','__expectedType__'].includes(k))){const to=expandUuid(value.__uuid__);edges.push({from:id,to});pending.push(to);}else for(const child of Object.values(value))stack.push(child);}
  }return {assets,edges,findings};
 }
}
