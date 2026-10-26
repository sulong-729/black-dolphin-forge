import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
export const scriptUuid='fa96e228-dc78-4970-94e2-2e3cc0f0193a';
export const compactScript='fa96eIo3HhJcJTiLjzA8Bk6';
export const data=()=>[
 {__type__:'cc.Prefab',data:{__id__:1},_name:'Fixture'},
 {__type__:'cc.Node',_name:'Root',_parent:null,_children:[{__id__:2},{__id__:3}],_components:[{__id__:4}],_active:false,_id:'root-file-id',_lpos:{__type__:'cc.Vec3',x:1,y:2,z:3}},
 {__type__:'cc.Node',_name:'A/B~[]#',_parent:{__id__:1},_children:[],_components:[{__id__:5}],_active:true,_id:'child-file-id'},
 {__type__:'cc.Node',_name:'A/B~[]#',_parent:{__id__:1},_children:[],_components:[{__id__:6}],_active:true},
 {__type__:compactScript,node:{__id__:1},target:{__id__:2},widget:{__id__:5},shared:{__id__:7},business:{id:123,uuid:scriptUuid,fileId:'user-file-id'},text:'hello',count:2,nullable:null,_id:'component-file-id'},
 {__type__:'cc.Widget',node:{__id__:2},_top:10,_target:{__id__:1}},
 {__type__:'cc.Widget',node:{__id__:3},_top:20,_target:{__id__:1},shared:{__id__:7}},
 {__type__:'Fixture.Record',peer:{__id__:8},value:1},
 {__type__:'Fixture.Record',peer:{__id__:7},value:2},
 {__type__:'Missing.Class',unknown:{__type__:'Mystery.Native',uuid:'business-string',x:5},_id:'hidden-storage'}
];
export async function fixture(t,modify=x=>x){const root=await mkdtemp(path.join(os.tmpdir(),'cocos p2 '));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'package.json'),JSON.stringify({creator:{version:'3.7.3'}}));await writeFile(path.join(root,'assets/View.ts'),'import {_decorator,Component} from "cc"; const {ccclass}=_decorator; @ccclass("Fixture.View") export class View extends Component {}');await writeFile(path.join(root,'assets/View.ts.meta'),JSON.stringify({uuid:scriptUuid,importer:'typescript'}));const raw=JSON.stringify(modify(data()),null,2)+'\n';const file=path.join(root,'assets/UI.prefab');await writeFile(file,raw);return {root,file,raw,project:'fixture-'+path.basename(root)};}
export function context(f,extra={}){return {project:f.project,source:'disk',document:'db://assets/UI.prefab',session:null,creatorVersion:'3.7.3',...extra};}
export const schemas={
 'cc.Node':{fields:{_active:{kind:'boolean'},_lpos:{kind:'value',type:'cc.Vec3',fields:{x:{kind:'number'},y:{kind:'number'},z:{kind:'number'}}}}},
 'Fixture.View':{fields:{count:{kind:'number'},text:{kind:'string'},target:{kind:'ref',targetType:'node'},widget:{kind:'ref',targetType:'component',type:'cc.Widget'},shared:{kind:'ref',targetType:'record',type:'Fixture.Record'}}},
 'cc.Widget':{fields:{_top:{kind:'number'},_target:{kind:'ref',targetType:'node'}}},
 'Fixture.Record':{fields:{value:{kind:'number'},peer:{kind:'ref',targetType:'record',type:'Fixture.Record'}}}
};
