// Owns only the standalone P3 project and its Creator child. Never targets game projects.
import {mkdir,writeFile,readFile,cp,rm,appendFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';
import {startServer} from '../dist/daemon/server.js';import {createRequest} from '../dist/contracts/index.js';
const kit=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),project=path.join(kit,'.superpowers/p3-creator-project'),evidence=path.join(kit,'docs/testing/evidence/p3');
await mkdir(evidence,{recursive:true});await mkdir(project,{recursive:true});const {open,unlink}=await import('node:fs/promises');const lockPath=path.join(project,'qualification.lock');const lock=await open(lockPath,'wx',0o600);await lock.writeFile(String(process.pid));
const server=await startServer({stateDir:path.join(project,'kit-state')});const registered=await server.dispatch(createRequest('project.register',{root:project}));if(registered.status!=='ok')throw Error(JSON.stringify(registered));const projectId=registered.data.id;
const extension=path.join(project,'extensions/cocos-ai-bridge');await cp(path.join(kit,'extensions/cocos-ai-bridge'),extension,{recursive:true});await writeFile(path.join(extension,'config.json'),JSON.stringify({endpoint:path.join(project,'kit-state/endpoint.json'),projectId}));
await cp(path.join(kit,'tests/fixtures/editor/qualification-main.cjs'),path.join(project,'extensions/p3-probe/main.cjs'));
await cp(path.join(kit,'tests/fixtures/editor/qualification-scene.cjs'),path.join(project,'extensions/p3-probe/scene.cjs'));
await rm(path.join(project,'qualification-result.json'),{force:true});
const binary=process.env.COCOS_CREATOR_EXECUTABLE||'/Applications/Cocos/Creator/3.7.3/CocosCreator.app/Contents/MacOS/CocosCreator';const child=spawn(binary,['--project',project,'--nologin'],{stdio:['ignore','pipe','pipe'],windowsHide:true});let logs='';await writeFile(path.join(evidence,'creator-live.log'),'');for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs+=b;void appendFile(path.join(evidence,'creator-live.log'),b);});child.on('error',e=>{logs+=String(e);});
const run=(operation,params={},extra={})=>server.dispatch(createRequest(operation,params,{projectId,...extra}));
async function wait(predicate,ms=120000){const start=Date.now();while(Date.now()-start<ms){const result=await predicate();if(result)return result;await new Promise(r=>setTimeout(r,500));}throw Error('Qualification timeout');}
async function data(result){if(result.status!=='ok')throw Error(JSON.stringify(result));const snap=server.snapshots.get(result.data.snapshot);return {meta:result.data,data:snap.data};}
async function query(params,session){for(let attempt=0;attempt<10;attempt++){const result=await run('editor.query',params,{source:'editor',session});if(result.status==='error'&&result.error?.code==='STALE_REVISION'){await new Promise(r=>setTimeout(r,300));continue;}return data(result);}throw Error('Editor did not settle within 10 read retries');}
let report;
const stages=[];
try{
 const session=await wait(async()=>{try{await readFile(path.join(project,'qualification-created.json'));}catch{return null;}const result=await run('editor.sessions');return result.data?.find(s=>s.state.stage==='scene'&&s.state.document.endsWith('Qualification.scene')&&!s.state.importing);});
 const diskBefore=await readFile(path.join(project,'assets/Qualification.scene'),'utf8');
 const before=await query({command:'scene.capture'},session.session);
 const inventory=[];let offset=0,schema;do{const page=await query({command:'schema.list',offset,limit:50,...(schema?{schema}:{})},session.session);schema=page.data.schema;inventory.push(...page.data.classes);offset=page.data.nextOffset;}while(offset!==null);
 const button=await query({command:'schema.describe',type:'cc.Button',schema},session.session);
 const custom=await query({command:'schema.describe',type:'KitFixture',schema},session.session);if(!custom.data.type.fields.some(f=>f.name==='target'&&f.type==='cc.Node')||!custom.data.type.fields.some(f=>f.name==='mode'&&f.enum?.some(e=>e.value===2)))throw Error('Custom inherited schema mismatch');
 await writeFile(path.join(project,'qualification-command.json'),JSON.stringify({command:'edit'}));
 const native=await wait(async()=>{try{const r=JSON.parse(await readFile(path.join(project,'qualification-result.json'),'utf8'));return r.status==='PASS'?r:null;}catch{return null;}});
 await wait(async()=>{const r=await run('editor.sessions');return r.data?.find(s=>s.session===session.session&&s.state.dirty&&s.state.revision!==session.state.revision);});
 const edited=await query({command:'scene.capture'},session.session);
 const diskAfter=await readFile(path.join(project,'assets/Qualification.scene'),'utf8');if(diskAfter!==diskBefore)throw Error('Unsaved Inspector edit changed disk source');
 const expired=await run('snapshot.query',{snapshot:before.meta.snapshot});if(expired.error?.code!=='SNAPSHOT_EXPIRED')throw Error('Old Editor snapshot survived dirty change');
 if(before.data.length!==native.nodeCount||!edited.data.some(n=>n.name==='Panel'&&n.position.value.x===99)||!edited.data.some(n=>n.name==='Hidden'&&n.active===false))throw Error('Inspector tree/live values mismatch: '+JSON.stringify({beforeCount:before.data.length,nativeCount:native.nodeCount,nodes:edited.data.map(n=>({name:n.name,active:n.active,x:n.position?.value?.x}))}));
 await writeFile(path.join(project,'qualification-stage.json'),'{}');
 const prefabSession=await wait(async()=>{const r=await run('editor.sessions');return r.data?.find(s=>s.state.stage==='prefab'&&!s.state.importing);},45000);
 const prefab=await query({command:'scene.capture'},prefabSession.session);stages.push(prefab);const switched=await run('snapshot.query',{snapshot:edited.meta.snapshot});if(switched.error?.code!=='SNAPSHOT_EXPIRED')throw Error('Old scene snapshot survived prefab stage switch');
 report={status:'PASS',stages,creator:'3.7.3',project:'standalone synthetic only',native,registry:{total:inventory.length,componentCount:inventory.filter(c=>c.component).length,classes:inventory},button:button.data,custom:custom.data,initial:before,edited,staleSnapshot:expired.error.code,stageSnapshot:switched.error.code,diskSourceUnchanged:diskBefore===diskAfter,limits:['Windows not run','Nested prefab Inspector qualification pending','No mutation capabilities enabled'],timestamp:new Date().toISOString()};
}catch(e){report={status:'FAIL',error:String(e.stack||e)};process.exitCode=1;}finally{child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);const timer=setTimeout(()=>{child.kill('SIGKILL');},3000);timer.unref();});await server.close();await lock.close();await unlink(lockPath);await writeFile(path.join(evidence,'creator.log'),logs);await writeFile(path.join(evidence,'creator-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,classes:report.registry?.total,error:report.error}));
