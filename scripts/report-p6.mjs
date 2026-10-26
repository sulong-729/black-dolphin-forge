import {readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import path from 'node:path';
const dir='docs/testing/evidence/p6',read=async n=>JSON.parse(await readFile(dir+'/'+n+'.json','utf8'));
const captures=await Promise.all(['reference','tall','restored'].map(read)),[ref,tall,restored]=captures;
for(const [i,r] of captures.entries()){assert.equal(r.status,'PASS');assert.equal(r.meta.viewport.renderCanvas.width,720);assert.equal(r.meta.viewport.renderCanvas.height,i===1?1920:1280);assert.equal(r.meta.observed.consistentFrame,true);}
const node=(r,n)=>r.nodes.find(x=>x.name===n),geo=(r,n)=>node(r,n).ui.geometry;
assert.deepEqual(captures.map(r=>geo(r,'LongPopup').height),[1080,1720,1080]);
assert.deepEqual(captures.map(r=>geo(r,'ShortFooter').height),[330,650,330]);
for(const r of captures){assert.equal(geo(r,'ShortControls').height,200);assert.equal(Math.round(Math.min(...geo(r,'ShortFooter').screenCorners.map(c=>c.y))),-40);assert.equal(node(r,'ActiveChild').activeInHierarchy,false);}
const geometry=r=>r.nodes.map(n=>({path:n.path,geometry:n.ui.geometry.availability==='available'?{width:n.ui.geometry.width,height:n.ui.geometry.height,anchor:n.ui.geometry.anchor,worldCorners:n.ui.geometry.worldCorners,screenCorners:n.ui.geometry.screenCorners}:null}));assert.deepEqual(geometry(ref),geometry(restored));
const check=await readFile('/tmp/cocos-p6-check.log','utf8');assert.match(check,/# fail 0\b/);await copyFile('/tmp/cocos-p6-check.log',dir+'/check.txt');
const scope={
'RUN-001':'Explicit scoped permit/bootstrap on actual Creator 3.7.3 preview; disabled guard has no engine/network access in contract test.',
'RUN-003':'Runtime namespace and unresolved source/Editor correspondence explicitly labeled; no inferred name matching.',
'RUN-004':'Actual after-draw captures report same start/end frame and honest observation window.',
'RUN-006':'Controlled reconnect and A/B/A scene reentry expire snapshots and handles; actual preview capture separately qualified.',
'RUN-007':'Web component observations and unavailable native capability explicitly separated; no native execution claim.',
'RUN-008':'Read adapters never align/layout/activate/play/stop; controlled spy assertions and actual inactive hierarchy.',
'UI-001':'Actual locally active child under inactive parent retained with hierarchy false.',
'UI-002':'Literal rotated/scaled world-corner assertions plus actual camera render-pixel geometry.',
'UI-005':'ScrollView references/offset read without mutation in actual preview and controlled tests.',
'UI-009':'Actual 720x1280 reference/restored own geometry equal, screenshots retained locally.',
'UI-010':'Actual 720x1920 backing canvas: long height1720, fixed short controls, footer hidden40px; reference restored.',
'DOM-001':'Existing Animation states read without getState initialization; actual Pulse fixture and controlled state test.',
'DOM-003':'Spine/controller integration explicitly unavailable; no package assumed.',
'DOM-010':'Uninitialized/no-op physics velocity and absent native/backend counters explicitly unavailable; controlled regression tests.'};
const report={phase:'P6',version:'0.6.0',status:'PASS_SCOPED',timestamp:new Date().toISOString(),platform:process.platform,arch:process.arch,node:process.version,tests:Number(/# tests (\d+)/.exec(check)[1]),cases:scope,preview:{creator:'3.7.3',sizes:['720x1280','720x1920','720x1280'],referenceRestoredGeometryEqual:true,hiddenFooterPixels:40,captures:captures.map(r=>({label:r.label,viewport:r.meta.viewport,observed:r.meta.observed,nodes:r.nodes.length}))},review:{independent:'Completed; three Important findings reproduced RED and corrected GREEN',fixed:['fresh epochs on every scene transition','stop cancels pending frame callbacks and prevents late responses','uninitialized/no-op physics velocity cannot fabricate zero']},completion:{task61:'Scoped web preview observations and UI diagnostics qualified',task62:'Read-only domain adapters implemented; domain action adapters not complete'},limitations:['Windows, native devices and release artifact qualification NOT_RUN','Runtime actions including pause/step, animation/audio/input/physics writes remain unavailable','Editor/source correspondence unresolved; no automatic matching','Component reads are not whole-backend profiling','Other engine versions/custom getters are unqualified','P5.2 broad structural/prefab/asset/source/array edits remain incomplete'],evidence:{preview:'preview-report.json',check:'check.txt',manifest:'manifest.json',screenshots:['reference.png','tall.png','restored.png']}};
await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');
const cases=JSON.parse(await readFile('docs/testing/test-cases.json','utf8'));for(const c of cases)if(scope[c.id]){c.status='PASS';c.evidence=dir+'/report.json#'+c.id+'; '+scope[c.id]+' Windows/native NOT_RUN.';}
await writeFile('docs/testing/test-cases.json',JSON.stringify(cases,null,2)+'\n');const columns=Object.keys(cases[0]),csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';await writeFile('docs/testing/test-cases.csv',columns.map(csv).join(',')+'\n'+cases.map(c=>columns.map(k=>csv(c[k])).join(',')).join('\n')+'\n');
const hashes={};async function collect(p){for(const e of await readdir(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())await collect(f);else hashes[f]=createHash('sha256').update(await readFile(f)).digest('hex');}}
for(const p of ['src/runtime','src/domains','runtime','tests/runtime','tests/fixtures/runtime'])await collect(p);
for(const f of ['scripts/report-p6.mjs','scripts/qualify-runtime.mjs','src/daemon/server.ts','src/daemon/dispatcher.ts','src/snapshots/store.ts','tsconfig.runtime.json','package.json','package-lock.json',...['reference.json','tall.json','restored.json','reference.png','tall.png','restored.png','preview-report.json','check.txt'].map(n=>dir+'/'+n)])hashes[f]=createHash('sha256').update(await readFile(f)).digest('hex');await writeFile(dir+'/manifest.json',JSON.stringify(hashes,null,2)+'\n');console.log(JSON.stringify({tests:report.tests,pass:cases.filter(c=>c.status==='PASS').length,notRun:cases.filter(c=>c.status==='NOT_RUN').length,status:report.status}));
