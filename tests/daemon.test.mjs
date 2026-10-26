import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {startServer} from '../dist/daemon.js';import {createRequest} from '../dist/contracts/index.js';
test('retired prototype Editor endpoints cannot register or mutate engine state',async()=>{const dir=await mkdtemp(path.join(os.tmpdir(),'cocos retired '));const server=await startServer({stateDir:dir});try{for(const op of ['editor.register','editor.poll','editor.respond','editor.apply'])assert.equal((await server.dispatch(createRequest(op))).status,'error');}finally{await server.close();await rm(dir,{recursive:true,force:true});}});
