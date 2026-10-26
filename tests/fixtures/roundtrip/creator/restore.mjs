import {readFile} from 'node:fs/promises';import path from 'node:path';
import {decode} from '../../../../dist/graph/decode.js';import {writeSeparate} from '../../../../dist/graph/encode.js';
const [project,dir]=process.argv.slice(2),source=path.join(dir,'native-original.prefab'),output=path.join(dir,'native-restored.prefab');
const raw=await readFile(source,'utf8');const document='db://'+path.relative(project,source).split(path.sep).join('/');
const doc=decode(raw,{project:'p2-creator-fixture',source:'disk',document,session:null,creatorVersion:'3.7.3'},{schemas:{'cc.Node':{fields:{_lpos:{kind:'value',type:'cc.Vec3',fields:{x:{kind:'number'},y:{kind:'number'},z:{kind:'number'}}}}}}});
const root=doc.resolve('Root');const result=await writeSeparate(doc,[{operation:'property.set',target:root.ref,selector:[{field:'_lpos'},{field:'x'}],expected:root.properties._lpos.fields.x,value:{kind:'number',value:99}}],{root:project,source,output});console.log(JSON.stringify({changes:result.changes,revision:doc.view.revision,coverage:doc.view.coverage}));
