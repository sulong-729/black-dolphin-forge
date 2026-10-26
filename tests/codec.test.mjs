import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {exportUI,restoreUI,writeRestored} from '../dist/codec.js';
const uuid='fa96e228-dc78-4970-94e2-2e3cc0f0193a', compressed='fa96eIo3HhJcJTiLjzA8Bk6';
async function fixture(fn){
 const root=await mkdtemp(path.join(os.tmpdir(),'cocos-kit-'));
 try{
  await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'package.json'),JSON.stringify({creator:{version:'3.7.3'}}));
  await writeFile(path.join(root,'assets/View.ts'),'import {_decorator,Component} from "cc"; const {ccclass}=_decorator; @ccclass("View") export class View extends Component {}');
  await writeFile(path.join(root,'assets/View.ts.meta'),JSON.stringify({uuid}));
  await writeFile(path.join(root,'assets/icon.png'),'fixture');await writeFile(path.join(root,'assets/icon.png.meta'),JSON.stringify({uuid:'texture-uuid',subMetas:{frame:{uuid:'texture-uuid@frame',importer:'sprite-frame'}}}));
  const data=[{__type__:'cc.Prefab',data:{__id__:1}},
   {__type__:'cc.Node',_name:'Canvas',_active:false,_parent:null,_children:[{__id__:2},{__id__:3}],_components:[{__id__:4}],_id:'original-root-id'},
   {__type__:'cc.Node',_name:'A/B~',_active:true,_parent:{__id__:1},_children:[],_components:[{__id__:5}],_id:'original-child-id'},
   {__type__:'cc.Node',_name:'A/B~',_active:true,_parent:{__id__:1},_children:[],_components:[],_id:'duplicate-node'},
   {__type__:compressed,node:{__id__:1},target:{__id__:2},widget:{__id__:5},events:[{__id__:6}],_id:'component-id'},
   {__type__:'cc.Widget',node:{__id__:2},_top:10,_target:{__id__:1},icon:{__uuid__:'texture-uuid@frame',__expectedType__:'cc.SpriteFrame'}},
   {__type__:'cc.ClickEvent',target:{__id__:1},handler:'onClick'}];
  const file=path.join(root,'assets/UI.prefab'),raw=JSON.stringify(data,null,2)+'\n';await writeFile(file,raw);await fn({root,file,raw,data});
 }finally{await rm(root,{recursive:true,force:true});}
}
test('no-edit roundtrip byte-identical; UI references use paths',()=>fixture(async({root,file,raw})=>{
 const {ui,map}=await exportUI(root,file);assert.equal(restoreUI(ui,map).text,raw);
 const s=JSON.stringify(ui);for(const id of ['__id__','__uuid__','original-root-id',compressed])assert.ok(!s.includes(id),id);
 assert.equal(ui.nodes[0].path,'/Canvas');assert.equal(ui.nodes[1].path,'/Canvas/A~1B~0[0]');assert.equal(ui.nodes[2].path,'/Canvas/A~1B~0[1]');assert.equal(ui.nodes[1].activeInHierarchy,false);
 const view=ui.nodes[0].components[0];assert.equal(view.type,'View');assert.equal(view.script,'db://assets/View.ts');assert.equal(view.properties.target.$node,ui.nodes[1].path);assert.equal(view.properties.widget.$component,ui.nodes[1].components[0].path);
 assert.equal(ui.nodes[1].components[0].properties.icon.$asset,'db://assets/icon.png#frame');assert.equal(ui.records[0].properties.target.$node,'/Canvas');assert.equal(await readFile(file,'utf8'),raw);
}));
test('edited values and paths restore original IDs, sub-asset and records',()=>fixture(async({root,file,data})=>{
 const {ui,map}=await exportUI(root,file);ui.nodes[0].components[0].properties.target={$node:ui.nodes[2].path};ui.nodes[1].components[0].properties._top=25;ui.records[0].properties.handler='onNewClick';
 const a=JSON.parse(restoreUI(ui,map).text);assert.deepEqual(a[4].target,{__id__:3});assert.equal(a[5]._top,25);assert.equal(a[6].handler,'onNewClick');assert.deepEqual(a[5].icon,data[5].icon);assert.equal(a[1]._id,'original-root-id');assert.deepEqual(a[1]._children,data[1]._children);
}));
test('invalid references, structural edits and wrong snapshots rejected',()=>fixture(async({root,file})=>{
 const {ui,map}=await exportUI(root,file);
 const bad=structuredClone(ui);bad.nodes[0].components[0].properties.target={$node:'/missing'};assert.throws(()=>restoreUI(bad,map),/reference|path/i);
 const renamed=structuredClone(ui);renamed.nodes[0].name='Changed';assert.throws(()=>restoreUI(renamed,map),/structur/i);
 const deleted=structuredClone(ui);deleted.nodes.pop();assert.throws(()=>restoreUI(deleted,map),/structur/i);
 const duplicate=structuredClone(ui);duplicate.nodes[1].path=duplicate.nodes[0].path;assert.throws(()=>restoreUI(duplicate,map),/structur|duplicate/i);
 const wrong=structuredClone(ui);wrong.snapshotId='wrong';assert.throws(()=>restoreUI(wrong,map),/snapshot/i);
}));
test('apply rejects stale source, separate output preserves original',()=>fixture(async({root,file,raw})=>{
 const {ui,map}=await exportUI(root,file);ui.nodes[1].components[0].properties._top=40;const output=path.join(root,'assets/Restored.prefab');await writeRestored(ui,map,{output});assert.equal(await readFile(file,'utf8'),raw);assert.equal(JSON.parse(await readFile(output,'utf8'))[5]._top,40);
 await writeFile(file,raw+' ');await assert.rejects(writeRestored(ui,map,{apply:true}),/stale|changed/i);assert.equal(await readFile(file,'utf8'),raw+' ');
}));
test('dangling refs and unsupported overrides surfaced and block restore',()=>fixture(async({root,file,data})=>{
 data[4].target={__id__:999};data.push({__type__:'cc.PropertyOverrideInfo',propertyPath:['x'],value:1});await writeFile(file,JSON.stringify(data));const {ui,map}=await exportUI(root,file);assert.equal(ui.complete,false);assert.ok(ui.warnings.length>=2);assert.ok(ui.nodes[0].components[0].properties.target.$unresolved);ui.nodes[1].components[0].properties._top=11;assert.throws(()=>restoreUI(ui,map),/unsupported|incomplete/i);
}));
test('rejects reading outside project',()=>fixture(async({root})=>{const dir=await mkdtemp(path.join(os.tmpdir(),'cocos-separate-'));try{const outside=path.join(dir,'data.json');await writeFile(outside,'[]');await assert.rejects(exportUI(root,outside),e=>e.message==='Path outside project');}finally{await rm(dir,{recursive:true,force:true});}}));
test('review regression: nonexistent outside path rejected consistently across OS',()=>fixture(async({root})=>{await assert.rejects(exportUI(root,path.join(root,'..','never-created-cocos-prefab.json')),e=>e.message==='Path outside project');}));
