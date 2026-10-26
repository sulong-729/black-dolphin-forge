import {readFile} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {hash,walk} from './project.js';
export interface Asset {uuid:string;uri:string;file:string;importer?:string;className?:string}
export interface Index {byUuid:Map<string,Asset>;byUri:Map<string,Asset>;dependencies:Record<string,string>;warnings:string[]}
export function expandUuid(value:string):string{
 const [base,...tail]=value.split('@');let uuid=base;
 if(base.length===22||base.length===23){
  const prefix=base.length===23?5:2;let hex=base.slice(0,prefix);const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for(let i=prefix;i<base.length;i+=2){const a=alphabet.indexOf(base[i]),b=alphabet.indexOf(base[i+1]);if(a<0||b<0)return value;hex+=(a>>2).toString(16)+(((a&3)<<2)|(b>>4)).toString(16)+(b&15).toString(16);}
  if(hex.length===32)uuid=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 }
 return [uuid,...tail].join('@');
}
function className(source:string,file:string):string|undefined{
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);let found:string|undefined;
 function visit(node:ts.Node){
  if(ts.isClassDeclaration(node)&&ts.canHaveDecorators(node))for(const decorator of ts.getDecorators(node)||[]){
   const call=decorator.expression;if(ts.isCallExpression(call)&&((ts.isIdentifier(call.expression)&&call.expression.text==='ccclass')||(ts.isPropertyAccessExpression(call.expression)&&call.expression.name.text==='ccclass'))){const arg=call.arguments[0];if(arg&&ts.isStringLiteral(arg))found=arg.text;}
  }
  ts.forEachChild(node,visit);
 }visit(ast);return found;
}
export async function assetIndex(root:string):Promise<Index>{
 const index:Index={byUuid:new Map(),byUri:new Map(),dependencies:{},warnings:[]};
 function add(asset:Asset){
  const key=expandUuid(asset.uuid),old=index.byUuid.get(key);
  if(old&&old.uri!==asset.uri){index.warnings.push(`Duplicate asset UUID at ${asset.uri} and ${old.uri}`);return;}
  index.byUuid.set(key,asset);index.byUri.set(asset.uri,asset);
 }
 for await(const file of walk(root)){
  if(!file.endsWith('.meta'))continue;
  let text;try{text=await readFile(file,'utf8');}catch{continue;}
  index.dependencies[file]=hash(text);
  let meta;try{meta=JSON.parse(text);}catch{index.warnings.push(`Malformed metadata: ${path.relative(root,file)}`);continue;}
  const assetFile=file.slice(0,-5),uri='db://'+path.relative(root,assetFile).split(path.sep).join('/');
  let declaredClass:string|undefined;
  if(/\.[cm]?[jt]s$/.test(assetFile)){try{const source=await readFile(assetFile,'utf8');index.dependencies[assetFile]=hash(source);declaredClass=className(source,assetFile);}catch{}}
  function addMeta(entry:any,subpath:string[]){
   if(typeof entry.uuid==='string')add({uuid:entry.uuid,uri:uri+(subpath.length?'#'+subpath.map(encodeURIComponent).join('/') :''),file:assetFile,importer:entry.importer,className:declaredClass});
   for(const [key,value]of Object.entries(entry.subMetas||{}))addMeta(value,[...subpath,key]);
  }addMeta(meta,[]);
 }
 return index;
}
