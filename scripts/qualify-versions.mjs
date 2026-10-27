import {mkdir,writeFile,readFile,cp,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startServer} from '../dist/daemon/server.js';
import {createRequest} from '../dist/contracts/index.js';
import {installEditorBridge} from '../dist/editor/install.js';

const version=process.argv[2];if(!['3.6.3','2.4.15'].includes(version))throw Error('Installed qualification versions: 3.6.3 / 2.4.15');
const legacy=version.startsWith('2.'),root=path.resolve('.superpowers/compat-'+version),state=path.join(root,'.kit-state');
await mkdir(root); // Do not replace a previous fixture.
if(legacy){await cp('/Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/Resources/templates/hello-world',root,{recursive:true});await writeFile(path.join(root,'project.json'),JSON.stringify({engine:'cocos2d-html5',packages:'packages',version}));}
else{await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'package.json'),JSON.stringify({name:'forge-compat',uuid:'c319b501-8784-4f05-a94d-081c0f82c679',creator:{version}}));await cp('tests/fixtures/build/Build.scene',path.join(root,'assets/Test.scene'));await writeFile(path.join(root,'assets/Test.scene.meta'),JSON.stringify({ver:'1.1.39',importer:'scene',imported:true,uuid:'11111111-1111-4111-8111-111111111111',files:['.json']}));}
const daemon=await startServer({stateDir:state}),project=(await daemon.dispatch(createRequest('project.register',{root}))).data;
const run=(name,params={},extra={})=>daemon.dispatch(createRequest(name,params,{projectId:project.id,...extra}));
await installEditorBridge(state,project.id);
const probe=path.join(root,legacy?'packages':'extensions','forge-version-probe');await mkdir(probe,{recursive:true});
const scene=legacy?'2d2f792f-a40c-49bb-a189-ed176a246e49':'11111111-1111-4111-8111-111111111111';
await writeFile(path.join(probe,'package.json'),JSON.stringify(legacy?{name:'forge-version-probe',version:'1.0.0',main:'main.js'}:{name:'forge-version-probe',version:'1.0.0',package_version:2,main:'main.js'}));
await writeFile(path.join(probe,'main.js'),legacy?`let timer;exports.load=()=>{timer=setTimeout(()=>Editor.Ipc.sendToPanel('scene','scene:open-by-uuid','${scene}'),8000);};exports.unload=()=>clearTimeout(timer);`:`let timer;exports.load=()=>{timer=setTimeout(async()=>{try{await Editor.Message.request('scene','open-scene','${scene}');}catch(e){console.warn('[forge-probe] '+e);}},8000);};exports.unload=()=>clearTimeout(timer);`);
const evidence=path.resolve('output/compatibility/'+version);await mkdir(evidence,{recursive:true});
const executable='/Applications/Cocos/Creator/'+version+'/CocosCreator.app/Contents/MacOS/CocosCreator';
const child=spawn(executable,[legacy?'--path':'--project',root,...legacy?[]:['--nologin']],{stdio:['ignore','pipe','pipe'],detached:true});
let logWrites=Promise.resolve();for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logWrites=logWrites.then(()=>appendFile(path.join(evidence,'creator.log'),b));});
let result;try{
 const deadline=Date.now()+150000;let selected;
 while(Date.now()<deadline){const sessions=await run('editor.sessions');selected=sessions.data?.find(s=>s.state.stage==='scene');if(selected)break;await new Promise(r=>setTimeout(r,1500));}
 if(!selected)throw Error('No matching Editor scene session; see Creator log');
 const captured=await run('editor.query',{command:'scene.capture'},{source:'editor',session:selected.session});
 if(captured.status!=='ok')throw Error(JSON.stringify(captured.error));
 const page=await run('snapshot.query',{snapshot:captured.data.snapshot});
 result={status:'PASS',version,adapter:selected.adapter,creator:selected.creatorVersion,engine:selected.engineVersion,state:selected.state,capture:captured.data,firstPage:page.data,limits:['actual Mac Editor read only','no new mutation qualification','no Windows execution','build/runtime browser not established by this Editor test']};
}catch(e){result={status:'FAIL',version,error:String(e.message||e)};process.exitCode=1;}
finally{try{process.kill(-child.pid,'SIGTERM');}catch{}await daemon.close();await logWrites;await writeFile(path.join(evidence,'editor-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({version,status:result.status,error:result.error,evidence}));}
