import {z} from 'zod';import type {IncomingMessage,ServerResponse} from 'node:http';import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {KitError,errorInfo} from '../contracts/errors.js';import {RuntimeSessions} from './client.js';
const lease={session:z.string().uuid(),lease:z.string().length(64)};
const message=z.discriminatedUnion('action',[
 z.object({action:z.literal('connect'),instance:z.string().min(1).max(128),epoch:z.string().min(1).max(128),scene:z.string().min(1).max(4096),frame:z.number().int().nonnegative(),engineVersion:z.literal('3.7.3'),preview:z.literal(true),build:z.literal(false),features:z.array(z.enum(['ui','animation','render','physics','audio','input'])).max(6)}).strict(),
 z.object({action:z.literal('poll'),...lease,epoch:z.string().min(1).max(128),scene:z.string().min(1).max(4096),frame:z.number().int().nonnegative()}).strict(),
 z.object({action:z.literal('respond'),...lease,id:z.string().uuid(),epoch:z.string().min(1).max(128),data:z.unknown().optional(),error:z.string().max(500).optional()}).strict(),
 z.object({action:z.literal('disconnect'),...lease}).strict()
]);
const modules=new Set(['bridge.js','snapshot.js','identity.js','domains/ui.js','domains/animation.js','domains/render.js','domains/physics.js','domains/audio.js','domains/input.js']);
export async function runtimeHttp(runtime:RuntimeSessions,req:IncomingMessage,res:ServerResponse){
 const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 try{
  if(req.method==='GET'&&req.url?.startsWith('/v1/runtime/modules/')){const name=req.url.slice('/v1/runtime/modules/'.length);if(!modules.has(name))throw new KitError('NOT_FOUND','Runtime module not found');const content=await readFile(fileURLToPath(new URL('../preview-system/'+name,import.meta.url)));res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'});res.end(content);return;}
  if(req.url!=='/v1/runtime')throw new KitError('NOT_FOUND','Preview route not found');
  const origin=req.headers.origin;if(typeof origin!=='string'||!runtime.allowsOrigin(origin))throw new KitError('UNAUTHORIZED','Origin has no preview permission');
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){if(req.headers['access-control-request-method']!=='POST'||String(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(x=>x.trim()).some(x=>!['authorization','content-type'].includes(x)))throw new KitError('UNAUTHORIZED','Unsupported preview preflight');res.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'authorization, content-type','Cache-Control':'no-store'});res.end();return;}
  if(req.method!=='POST')throw new KitError('NOT_FOUND','Preview expects POST');
  const auth=req.headers.authorization||'',ticket=runtime.ticket(auth.startsWith('Bearer ')?auth.slice(7):'',origin);
  let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw new KitError('REQUEST_TOO_LARGE','Preview message exceeds 1 MiB');chunks.push(chunk);}
  let raw;try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new KitError('SCHEMA_MISMATCH','Malformed preview JSON');}const parsed=message.safeParse(raw);if(!parsed.success)throw new KitError('SCHEMA_MISMATCH','Invalid preview message');const p=parsed.data;
  const data=p.action==='connect'?runtime.connect(ticket,p):p.action==='poll'?runtime.poll(ticket,p):p.action==='respond'?runtime.respond(ticket,p):runtime.disconnect(ticket,p);send(200,{status:'ok',data});
 }catch(e){const error=e instanceof KitError?e:new KitError('INTERNAL_ERROR','Preview transport failed');send(error.code==='UNAUTHORIZED'?403:error.code==='REQUEST_TOO_LARGE'?413:error.code==='NOT_FOUND'?404:400,{status:'error',error:errorInfo(error)});}
}
