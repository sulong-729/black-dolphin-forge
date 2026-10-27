import {createRuntimeCapture} from './snapshot.js';
interface Options {cc:any;url:string;token:string;preview:boolean;build:boolean;signal?:AbortSignal;}
export async function attachPreview(options:Options){
 if(options.preview!==true||options.build!==false)return {enabled:false,stop:async()=>{}};
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(options.url)||!/^\w{64}$/.test(options.token)||!['3.7.3','3.6.3','2.1.3','2.4.15'].includes(options.cc.ENGINE_VERSION??options.cc.VERSION))throw Error('UNAVAILABLE_CAPABILITY: qualified local Cocos preview required');
 const observer=createRuntimeCapture(options.cc);observer.context();
 const instance=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2),abort=new AbortController();
 let connection:any=null,stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
 const pending=new Set<()=>void>(),closed=()=>stopped||abort.signal.aborted;
 const credentials=()=>({session:connection.session,lease:connection.lease});
 async function send(body:any){
  if(closed())throw Error('UNAVAILABLE_CAPABILITY: runtime bridge stopped');
  const timeout=new AbortController(),onAbort=()=>timeout.abort();abort.signal.addEventListener('abort',onAbort,{once:true});
  const deadline=setTimeout(()=>timeout.abort(),5000);
  try{
   const result=await fetch(options.url+'/v1/runtime',{method:'POST',headers:{Authorization:'Bearer '+options.token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:timeout.signal});
   if(closed())throw Error('Runtime bridge stopped');
   const data=await result.json();if(closed())throw Error('Runtime bridge stopped');
   if(!result.ok||data.status!=='ok')throw Error(data.error?.code||'Runtime transport failed');return data.data;
  }finally{clearTimeout(deadline);abort.signal.removeEventListener('abort',onAbort);}
 }
 function frame(params:any){
  if(closed())return Promise.reject(Error('Runtime bridge stopped'));
  return new Promise<any>((resolve,reject)=>{
   const director=options.cc.director,event=options.cc.Director.EVENT_AFTER_DRAW;let deadline:ReturnType<typeof setTimeout>;
   const cancel=()=>{clearTimeout(deadline);director.off(event,read);pending.delete(cancel);reject(Error('UNAVAILABLE_CAPABILITY: runtime capture canceled'));};
   const read=()=>{clearTimeout(deadline);pending.delete(cancel);if(closed())return reject(Error('Runtime stopped'));try{resolve(observer.capture({...params,phase:'after-draw'}));}catch(e){reject(e);}};
   pending.add(cancel);director.once(event,read);deadline=setTimeout(cancel,6000);
  });
 }
 async function tick(){
  if(closed())return;
  try{
   const ctx=observer.context();
   if(!connection){const next=await send({action:'connect',instance,epoch:ctx.epoch,scene:ctx.scene,frame:ctx.frame,engineVersion:options.cc.ENGINE_VERSION??options.cc.VERSION,preview:true,build:false,features:['ui','animation','render','physics','audio','input']});if(closed())return;connection=next;observer.bindSession(connection.session);}
   const jobs=await send({action:'poll',...credentials(),epoch:ctx.epoch,scene:ctx.scene,frame:ctx.frame});if(closed())return;
   for(const job of jobs){
    if(closed())return;let response;
    try{if(job.command!=='runtime.capture')throw Error('UNSUPPORTED_OPERATION');const data=await frame(job.params);if(closed())return;response={data,epoch:data.epoch};}
    catch(e){if(closed())return;response={error:String((e as Error).message).slice(0,500),epoch:observer.context().epoch};}
    if(closed())return;await send({action:'respond',...credentials(),id:job.id,...response});
   }
  }catch(e){connection=null;if(!closed()&&(e as Error).message==='UNAUTHORIZED')await stop();}
  finally{if(!closed())timer=setTimeout(tick,400);}
 }
 async function stop(){
  if(stopped)return;stopped=true;if(timer)clearTimeout(timer);for(const cancel of [...pending])cancel();abort.abort();
  if(connection){const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),1000);try{await fetch(options.url+'/v1/runtime',{method:'POST',headers:{Authorization:'Bearer '+options.token,'Content-Type':'application/json'},body:JSON.stringify({action:'disconnect',...credentials()}),signal:controller.signal});}catch{}finally{clearTimeout(deadline);}}
  options.signal?.removeEventListener('abort',onAbort);
 }
 const onAbort=()=>void stop();if(options.signal?.aborted){await stop();return {enabled:false,stop};}options.signal?.addEventListener('abort',onAbort,{once:true});void tick();return {enabled:true,stop};
}
