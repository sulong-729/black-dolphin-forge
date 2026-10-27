import {mkdir,cp,writeFile,readFile,copyFile} from 'node:fs/promises';import path from 'node:path';
import {startServer} from '../dist/daemon/server.js';import {createRequest} from '../dist/contracts/index.js';
import {configureBuild} from '../dist/build/profiles.js';import {approveProposal} from '../dist/mutation/policy.js';
const version=process.argv[2];if(!['3.6.3','2.4.15'].includes(version))throw Error('Installed qualification versions only');
const legacy=version.startsWith('2.'),project=path.resolve('.superpowers/build-compat-'+version),state=path.resolve('.superpowers/build-compat-state-'+version),evidence=path.resolve('output/compatibility/'+version);
const reuse=process.argv.includes('--reuse');if(!reuse)await mkdir(project);await mkdir(evidence,{recursive:true});
let scene;
if(legacy&&!reuse){await cp('/Applications/Cocos/Creator/'+version+'/CocosCreator.app/Contents/Resources/templates/hello-world',project,{recursive:true});await writeFile(path.join(project,'project.json'),JSON.stringify({engine:'cocos2d-html5',packages:'packages',version}));scene='2d2f792f-a40c-49bb-a189-ed176a246e49';}
else if(!reuse){await mkdir(path.join(project,'assets'));await writeFile(path.join(project,'package.json'),JSON.stringify({name:'forge-build-compat',uuid:'c319b501-8784-4f05-a94d-081c0f82c679',creator:{version}}));for(const file of ['Build.scene','Build.scene.meta','BuildFixture.ts','BuildFixture.ts.meta'])await copyFile('tests/fixtures/build/'+file,path.join(project,'assets',file));scene=JSON.parse(await readFile(path.join(project,'assets/Build.scene.meta'),'utf8')).uuid;}
if(reuse)scene=legacy?'2d2f792f-a40c-49bb-a189-ed176a246e49':JSON.parse(await readFile(path.join(project,'assets/Build.scene.meta'),'utf8')).uuid;
const server=await startServer({stateDir:state});const ok=r=>{if(r.status!=='ok')throw Error(JSON.stringify(r.error));return r.data;};let result;
try{const registered=ok(await server.dispatch(createRequest('project.register',{root:project}))),profile=await configureBuild(state,registered.id,{version:1,python:'/usr/bin/python3',target:'web-mobile',scene,debug:true,timeoutMs:300000}),run=(op,params={})=>server.dispatch(createRequest(op,params,{projectId:registered.id})),attempts=[];
 for(let i=0;i<2;i++){
  const proposal=ok(await run('build.propose'));await approveProposal(state,proposal.id,proposal.hash);
  const started=ok(await run('job.start',{proposal:proposal.id,idempotencyKey:'compat-'+i}));console.log(JSON.stringify({stage:'running',version,job:started.job}));
  let job;do{await new Promise(r=>setTimeout(r,1500));job=ok(await run('job.status',{job:started.job}));}while(['running','queued'].includes(job.status));
  let manifest;try{manifest=JSON.parse(await readFile(path.join(state,'jobs',job.id,'manifest.json'),'utf8'));}catch{}
  await copyFile(path.join(state,'jobs',job.id,'log.txt'),path.join(evidence,'build-'+i+'.log'));attempts.push({job,manifest});
  if(job.status==='succeeded'||!manifest?.stale)break;
 }
 result={status:attempts.at(-1).job.status==='succeeded'?'PASS':'FAIL',version,autoSelected:profile,attempts,limits:['build output only; browser/visual/native not established']};
}catch(e){result={status:'FAIL',version,error:String(e.message||e)};}
finally{await server.close();await writeFile(path.join(evidence,'build-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({version,status:result.status,error:result.error}));if(result.status!=='PASS')process.exitCode=1;}
