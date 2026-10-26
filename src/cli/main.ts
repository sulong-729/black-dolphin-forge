#!/usr/bin/env node
import { startServer } from '../daemon/server.js';
import { startDaemon, stopDaemon, statusDaemon } from '../daemon/lifecycle.js';
import { call } from '../daemon/client.js';
import { createRequest } from '../contracts/envelopes.js';
import { errorInfo } from '../contracts/errors.js';
import { runMcp } from '../mcp/server.js';
const output = (value: unknown) => process.stdout.write(JSON.stringify(value) + '\n');
async function main() {
    const [command, sub, ...args] = process.argv.slice(2);
    if (command === 'daemon') {
        if (sub === 'serve') {
            const server = await startServer();
            let stopping = false;
            const stop = () => { if (stopping)
                return; stopping = true; void server.close().catch(e => { console.error(e); process.exitCode = 1; }); };
            process.once('SIGTERM', stop);
            process.once('SIGINT', stop);
            return;
        }
        if (sub === 'start') {
            const e = await startDaemon();
            output({ url: e.url, pid: e.pid, instanceId: e.instanceId });
            return;
        }
        if (sub === 'status') {
            const e = await statusDaemon();
            output(e ? { url: e.url, pid: e.pid, instanceId: e.instanceId } : { running: false });
            return;
        }
        if (sub === 'stop') {
            output({ stopped: await stopDaemon() });
            return;
        }
    }
    if (command === 'mcp') {
        await runMcp();
        return;
    }
    let request;
    if (command === 'rpc' || command === 'query')
        request = JSON.parse(sub);
    else if (command === 'describe')
        request = createRequest('capabilities.describe', sub ? { operation: sub } : {});
    else if (command === 'project' && sub === 'register')
        request = createRequest('project.register', { root: args[0] });
    else if (command === 'project' && sub === 'list')
        request = createRequest('project.list');
    else {
        output({ usage: ['daemon start|status|stop', 'project register <root>', 'project list', 'describe [operation]', 'rpc <JSON envelope>', 'mcp'] });
        return;
    }
    const result = await call(request,undefined,command==='query'?'cocos_query':undefined);
    output(result);
    if (result.status === 'error')
        process.exitCode = 1;
}
main().catch(error => { process.stderr.write(errorInfo(error).message + '\n'); process.exitCode = 1; });
