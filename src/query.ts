import {hash} from './project.js';
import type {UI} from './codec.js';
export interface QueryResult{snapshotId:string;source:string;complete:boolean;warnings:string[];total:number;items:any[];text:string;nextCursor?:string;encoding?:string}
export function queryUI(ui:UI,operation:string,params:Record<string,any>={}):QueryResult{
 const {cursor,...filters}=params,key=hash(JSON.stringify({snapshotId:ui.snapshotId,operation,filters}));
 let offset=0;
 if(cursor){try{const c=JSON.parse(Buffer.from(cursor,'base64url').toString());if(c.key!==key||!Number.isSafeInteger(c.offset)||c.offset<0)throw 0;offset=c.offset;}catch{throw new Error('Invalid cursor for this query/snapshot');}}
 const depth=params.depth??2,limit=params.limit??50;
 if(!Number.isInteger(depth)||depth<0||depth>100||!Number.isInteger(limit)||limit<1||limit>50)throw new Error('depth must be 0..100 and limit 1..50');
 let items:any[]=[];
 const component=(c:any)=>({path:c.path,type:c.type,...(c.script?{script:c.script}:{}),properties:params.fields?Object.fromEntries(params.fields.map((f:string)=>[f,c.properties[f]])):c.properties});
 if(operation==='summary')items=[{nodes:ui.nodes.length,components:ui.nodes.reduce((n,x)=>n+x.components.length,0),records:ui.records.length,creatorVersion:ui.creatorVersion}];
 else if(operation==='tree'||operation==='find'){
  const base=params.path?.replace(/\/$/,'');
  items=ui.nodes.filter(n=>!base||n.path===base||n.path.startsWith(base+'/')).filter(n=>operation==='find'||(base?n.path.slice(base.length).split('/').length-1:n.path.split('/').length-2)<=depth)
   .filter(n=>(!params.name||n.name.includes(params.name))&&(!params.component||n.components.some(c=>c.type===params.component))&&(params.active===undefined||n.activeInHierarchy===params.active))
   .map(n=>({path:n.path,name:n.name,activeSelf:n.activeSelf,activeInHierarchy:n.activeInHierarchy,components:n.components.map(c=>({type:c.type,...(c.script?{script:c.script}:{})}))}));
 }else if(operation==='inspect'){
  const nodes=ui.nodes.filter(n=>params.path?n.path===params.path:params.name?n.name===params.name:false);
  if(nodes.length!==1)throw new Error(nodes.length?'Ambiguous node; use full path':'Node path not found');
  items=params.component?nodes[0].components.filter(c=>c.type===params.component||c.path===params.component).map(component):[{...nodes[0],components:nodes[0].components.map(component)}];
  if(!items.length)throw new Error('Component not found');
 }else if(operation==='references'){
  function visit(v:any,location:string){if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(['$node','$component','$record','$asset','$unresolved'].includes(k))items.push({location,kind:k,target:x});else visit(x,location+'/'+k);}}
  for(const node of ui.nodes){if(params.path&&node.path!==params.path&&!node.path.startsWith(params.path+'/'))continue;visit(node.properties,node.path);for(const c of node.components)visit(c.properties,c.path);}
  for(const record of ui.records)visit(record.properties,record.path);
 }else if(operation==='validate')items=[{valid:ui.complete,issues:ui.warnings}];
 else throw new Error('Unsupported query operation: '+operation);
 const reply:QueryResult={snapshotId:ui.snapshotId,source:ui.source,complete:ui.complete,warnings:ui.warnings,total:items.length,items:[],text:''};
 const next=(n:number)=>Buffer.from(JSON.stringify({key,offset:n})).toString('base64url');
 if(items.some(item=>JSON.stringify(item).length>5800)){
  const json=JSON.stringify(items,null,2);if(offset>json.length)throw new Error('Invalid cursor offset');
  reply.encoding='json-fragments';reply.text=json.slice(offset,offset+5800);if(offset+5800<json.length)reply.nextCursor=next(offset+5800);return reply;
 }
 if(offset>items.length)throw new Error('Invalid cursor offset');
 for(const item of items.slice(offset,offset+limit)){
  const candidate=[...reply.items,item],text=JSON.stringify(candidate,null,2);
  if(text.length>6000)break;reply.items=candidate;reply.text=text;
 }
 if(!reply.text)reply.text='[]';if(offset+reply.items.length<items.length)reply.nextCursor=next(offset+reply.items.length);
 return reply;
}
