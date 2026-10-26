import {readFile,writeFile,readdir,stat} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';
const directory='docs/testing/evidence/p3';const native=JSON.parse(await readFile(directory+'/creator-report.json','utf8'));const check=await readFile(directory+'/check.txt','utf8');
if(native.status!=='PASS'||!/# fail 0\b/.test(check))throw Error('Fresh passing engine report and full check required');
const scoped={
 'ED-001':'Creator 3.7.3 actual registered project/session/probes and read-only owner routing.',
 'ED-003':'Actual Inspector set-property + snapshot: disk bytes unchanged, Editor x=99, dirty true, old snapshot expired.',
 'ED-004':'Actual scene -> prefab editing stage: explicit document/stage, old scene snapshot expired.',
 'ED-009':'Actual Inspector document node count and live tree parity; DontSave helper subtrees explicitly excluded.',
 'ED-010':'Native inactive node preserved; descriptor/proxy/metadata tests prove zero introduced getter invocations in scoped fixtures; no general script sandbox claim.',
 'CMP-001':'Actual engine constructor registry enumerated, aliases deduplicated; all write/roundtrip coverage false.',
 'CMP-002':'Actual compiled KitFixture TypeScript component discovered and described without hand registration.',
 'CMP-003':'Actual KitFixtureBase inherited target/flags fields with owning class retained.',
 'CMP-006':'Actual custom enum and builtin Button enum; exact bitmask preservation contract fixture only.',
 'CMP-007':'Actual custom Node|null declared type and nullable default; binding unavailable.',
 'CMP-009':'Actual custom visibility/serializable flags; builtin editorOnly metadata; no runtime qualification.',
 'CMP-010':'Actual builtin getter properties marked unavailable, writes false; malicious getter/proxy tests are contract fixtures.',
};
const contract=['ED-002','ED-005','ED-006','ED-007','ED-008','CMP-004','CMP-005','CMP-008','CMP-011','CMP-012','PREF-005','PREF-007','PREF-008'];
const report={phase:'P3',version:'0.3.0',timestamp:new Date().toISOString(),platform:process.platform,arch:process.arch,node:process.version,creator:native.creator,status:'PASS_SCOPED',nativeCases:scoped,contractOnly:contract,remaining:['Windows execution','Two actual Editor instances/reconnect/script reload/import transition lifecycle','Full nested-prefab override ownership/mounted/removed acceptance','Package/source identity navigation (P4)','Generic mutable/roundtrip qualification (P5+)'],nativeEvidence:'creator-report.json',fullCheck:'check.txt'};
await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n');
const cases=JSON.parse(await readFile('docs/testing/test-cases.json','utf8'));for(const c of cases)if(scoped[c.id]){c.status='PASS';c.evidence=directory+'/report.json#'+c.id+'; '+scoped[c.id]+' Windows NOT_RUN.';}else if(contract.includes(c.id)){c.evidence=directory+'/report.json#contractOnly; contract tests only; full Editor acceptance NOT_RUN.';}
await writeFile('docs/testing/test-cases.json',JSON.stringify(cases,null,2)+'\n');
const columns=Object.keys(cases[0]);const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';await writeFile('docs/testing/test-cases.csv',columns.map(escape).join(',')+'\n'+cases.map(c=>columns.map(k=>escape(c[k])).join(',')).join('\n')+'\n');
const hashes={};async function collect(dir){for(const entry of await readdir(dir)){const file=path.join(dir,entry);if((await stat(file)).isDirectory())await collect(file);else hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');}}
for(const dir of ['src/editor','src/schema','extensions/cocos-ai-bridge'])await collect(dir);for(const file of ['src/daemon/dispatcher.ts','src/daemon/server.ts','src/snapshots/store.ts',directory+'/creator-report.json',directory+'/check.txt'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');await writeFile(directory+'/manifest.json',JSON.stringify(hashes,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,pass:cases.filter(c=>c.status==='PASS').length,notRun:cases.filter(c=>c.status==='NOT_RUN').length,registry:native.registry.total}));
