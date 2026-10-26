import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fixture} from '../tests/helpers/graph-fixture.mjs';
import {startServer} from '../dist/daemon/server.js';
import {createRequest} from '../dist/contracts/index.js';
import {writeFile} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const clean=[],f=await fixture({after:fn=>clean.push(fn)}),state=path.join(f.root,'state');const server=await startServer({stateDir:state});const client=new Client({name:'p2-evidence',version:'1'});
try{
 const registered=await server.dispatch(createRequest('project.register',{root:f.root}));const projectId=registered.data.id;
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('dist/cli/main.js'),'mcp'],env:{...process.env,COCOS_AI_STATE_DIR:state},stderr:'pipe'}));
 const query=async(operation,params={})=>{const result=await client.callTool({name:'cocos_query',arguments:{request:createRequest(operation,params,{projectId})}});assert.equal(result.structuredContent,undefined);const body=JSON.parse(result.content[0].text);assert.equal(body.status,'ok',JSON.stringify(body));return body.data;};
 const cap=await query('graph.capture',{path:'assets/UI.prefab'});const nodes=await query('graph.query',{snapshot:cap.snapshot});const list=JSON.parse(nodes.text);assert.equal(list.length,3);assert.ok(!nodes.text.includes('__id__'));
 const component=await query('graph.resolve',{snapshot:cap.snapshot,target:'/Root#Fixture.View[0]'});const inspected=await query('graph.inspect',{snapshot:cap.snapshot,target:component.ref,fields:['count','business']});assert.ok(inspected.text.length<=6000);assert.equal(JSON.parse(inspected.text)[0].properties.business.fields.id.value,123);
 const report={status:'PASS',timestamp:new Date().toISOString(),transport:'Actual MCP SDK stdio client -> authenticated daemon -> P2 graph service',toolCount:(await client.listTools()).tools.length,nodes:list.length,inspectFields:['count','business'],nativeIdsHidden:true,structuredPayloadDuplication:false};await writeFile('docs/testing/evidence/p2/mcp-demo.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await client.close();await server.close();for(const cleanup of clean)await cleanup();}
