#!/usr/bin/env node
import {startDesktop,stopDesktop} from '../desktop/lifecycle.js';
import {pruneJobArtifacts} from '../jobs/prune.js';
import {controlService,currentServicePlan} from '../service/control.js';
import {installBundle,installed,rollbackBundle,uninstallBundle} from '../distribution/install.js';
import {reconcileJob} from '../jobs/recovery.js';
import path from 'node:path';
import {configureBuild} from '../build/profiles.js';
import {readFile} from 'node:fs/promises';
import {approveProposal} from '../mutation/policy.js';
import {platformPaths} from '../platform/paths.js';
import { startServer } from '../daemon/server.js';
import { startDaemon, stopDaemon, statusDaemon } from '../daemon/lifecycle.js';
import { call } from '../daemon/client.js';
import { createRequest } from '../contracts/envelopes.js';
import { errorInfo } from '../contracts/errors.js';
import { runMcp } from '../mcp/server.js';
const output = (value: unknown) => process.stdout.write(JSON.stringify(value) + '\n');
async function main() {
    const [command, sub, ...args] = process.argv.slice(2);
    if(command==='desktop'){if(sub==='start'){output(await startDesktop(platformPaths().state,process.env.COCOS_AI_LAUNCHER||process.argv[1],!args.includes('--no-open')));return;}if(sub==='stop'){output(await stopDesktop(platformPaths().state));return;}}
    if(command==='package') {const root=args[0];if(sub==='install'){output(await installBundle(root,args[1]));return;}if(sub==='status'){output(await installed(root));return;}if(sub==='rollback'){output(await rollbackBundle(root));return;}if(sub==='uninstall'){if(await statusDaemon())throw Error('Stop the daemon/service before uninstalling');output(await uninstallBundle(root));return;}}
    if(command==='service'){if(sub==='plan'){output(currentServicePlan(args[0]||process.argv[1]));return;}if(['install','uninstall','status','start','stop'].includes(sub)){output(await controlService(sub as 'install'|'uninstall'|'status'|'start'|'stop',args[0]||process.argv[1]));return;}if(sub==='host'){const state=args[0];if(!state||!path.isAbsolute(state))throw Error('Absolute service state path required');process.env.COCOS_AI_STATE_DIR=state;if(await statusDaemon(state))return;const server=await startServer({stateDir:state});const stop=()=>{void server.close();};process.once('SIGTERM',stop);process.once('SIGINT',stop);return;}}
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
    if(command==='job'&&sub==='prune'){output(await pruneJobArtifacts(path.join(platformPaths().state,'jobs'),args[0]));return;}
    if(command==='job'&&sub==='reconcile'){output(await reconcileJob(path.join(platformPaths().state,'jobs'),args[0],args[1]));return;}
    if(command==='build'&&sub==='configure'){output(await configureBuild(platformPaths().state,args[0],JSON.parse(await readFile(args[1],'utf8'))));return;}
    if (command === 'approve') { output(await approveProposal(platformPaths().state,sub,args[0])); return; }
    if (command === 'mcp') {
        await runMcp();
        return;
    }
    let request;
    if (command === 'rpc' || command === 'query')
        request = JSON.parse(sub);
    else if (command === 'describe')
        request = createRequest('capabilities.describe', sub ? { operation: sub } : {});
    else if (command === 'preview' && sub === 'permit')
        request=createRequest('runtime.preview.permit',{origin:args[1]},{projectId:args[0]});
    else if(command==='preview'&&sub==='revoke')
        request=createRequest('runtime.preview.revoke',{permit:args[1]},{projectId:args[0]});
    else if (command === 'project' && sub === 'register')
        request = createRequest('project.register', { root: args[0] });
    else if (command === 'project' && sub === 'list')
        request = createRequest('project.list');
    else {
        output({ usage: ['daemon start|status|stop', 'project register <root>', 'project list', 'describe [operation]', 'rpc <JSON envelope>', 'approve <proposal-id> <reviewed-hash>', 'preview permit <project-id> <origin>', 'preview revoke <project-id> <permit-id>', 'job prune <terminal-job-id>', 'job reconcile <job-id> <reviewed-hash>', 'build configure <project-id> <profile-json-file>', 'package install <bundle> <install-root>', 'package status|rollback|uninstall <install-root>', 'service plan|install|start|stop|status|uninstall [stable-launcher]', 'desktop start [--no-open]|stop', 'mcp'] });
        return;
    }
    const result = await call(request,undefined,command==='query'?'cocos_query':undefined);
    output(result);
    if (result.status === 'error')
        process.exitCode = 1;
}
main().catch(error => { process.stderr.write(errorInfo(error).message + '\n'); process.exitCode = 1; });
