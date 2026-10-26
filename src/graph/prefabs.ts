import {AssetIndex} from '../assets/index.js';
import {readDocument} from '../daemon/read-document.js';
import {KitError} from '../contracts/errors.js';
import {decode} from './decode.js';
import type {GraphContext,Graph} from './types.js';
/** Inventory serialized source documents, not effective nested-instance overrides. */
export async function inventoryPrefabs(uuid:string,index:AssetIndex,context:GraphContext,limits={documents:20,bytes:32*1024*1024}){
 const dependencies=await index.dependencies(uuid),documents:{graph:Graph}[]=[];let bytes=0;
 for(const asset of dependencies.assets){
  if(!asset.file.endsWith('.prefab'))continue;
  if(documents.length>=limits.documents)throw new KitError('RESOURCE_LIMIT','Prefab document budget exceeded');
  const raw=(await readDocument(asset.file)).toString();bytes+=Buffer.byteLength(raw);
  if(bytes>limits.bytes)throw new KitError('RESOURCE_LIMIT','Prefab inventory byte budget exceeded');
  documents.push({graph:decode(raw,{...context,document:asset.document},{assets:index}).view});
 }
 const documentFor=(id:string)=>{try{const a=index.resolveUuid(id);return {document:a.document,subAsset:a.subAsset};}catch{return {unresolved:true};}};
 return {documents,links:dependencies.edges.map(e=>({from:documentFor(e.from),to:documentFor(e.to)})),unresolvedDependencies:dependencies.findings.length,effectiveValuesQualified:false};
}
