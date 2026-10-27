'use strict';
// Configuration is explicitly written by a local installer/harness, never inferred from a game.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
let timer, running = false, connection = null, configuration = null, stopped = false;
let changeGeneration = 0;
const instance = crypto.randomBytes(16).toString('hex');
function endpoint() {
    const e = JSON.parse(fs.readFileSync(configuration.endpoint, 'utf8'));
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(e.url) || typeof e.token !== 'string' || e.token.length !== 64)
        throw Error('Invalid local daemon endpoint');
    return e;
}
function rpc(operation, params) {
    const e = endpoint(), body = JSON.stringify({ formatVersion: 1, requestId: crypto.randomBytes(12).toString('hex'), operation, projectId: configuration.projectId, source: 'disk', params });
    return new Promise((resolve, reject) => {
        const req = http.request(Object.assign(require('url').parse(e.url + '/v1/rpc'), { method: 'POST', headers: { Authorization: 'Bearer ' + e.token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }), res => {
            let text = '';
            res.on('data', chunk => {
                text += chunk;
                if (text.length > 1000000)
                    req.destroy(Error('RPC result too large'));
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(text);
                    if (result.status !== 'ok')
                        throw Error(result.error.code + ': ' + result.error.message);
                    resolve(result.data);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        req.setTimeout(9000, () => req.destroy(Error('RPC timeout')));
        req.on('error', reject);
        req.end(body);
    });
}
const legacy=!(Editor.Message&&typeof Editor.Message.request==='function');
const projectRoot=()=>Editor.Project&&Editor.Project.path||Editor.projectInfo&&Editor.projectInfo.path||Editor.projectPath;
const creatorVersion=()=>Editor.App&&Editor.App.version||require('electron').app.getVersion();
const scene = (method, args = []) => legacy?new Promise((resolve,reject)=>Editor.Scene.callSceneScript('cocos-ai-bridge','invoke',{method,args},(error,value)=>error?reject(Error(error.message||error)):resolve(value))):Editor.Message.request('scene', 'execute-scene-script', { name: 'cocos-ai-bridge', method, args });
async function context() {
    if(legacy){
        const probe=await scene('legacyContext');
        const url=probe.rootId?Editor.assetdb.uuidToUrl(probe.rootId):null;
        const ctx={generation:changeGeneration,document:url||'unsaved:'+probe.rootId,documentId:probe.rootId,rootId:probe.rootId,stage:url&&url.endsWith('.prefab')?'prefab':probe.rootId?'scene':'none',dirty:true,importing:!probe.rootId,assets:{}};
        for(const id of await scene('sources',[ctx]))ctx.assets[id]=Editor.assetdb.uuidToUrl(id);
        return ctx;
    }
    const current = await Editor.Message.request('scene', 'query-current-scene');
    const dirty = await Editor.Message.request('scene', 'query-dirty');
    const ready = await Editor.Message.request('scene', 'query-is-ready') && await Editor.Message.request('asset-db', 'query-ready');
    const uuid = typeof current === 'string' ? current : current && (current.uuid || current.id);
    const url = uuid ? await Editor.Message.request('asset-db', 'query-url', uuid) : null;
    const tree = ready && url ? await Editor.Message.request('scene', 'query-node-tree') : null;
    const after = await Editor.Message.request('scene', 'query-current-scene');
    if (JSON.stringify(current) !== JSON.stringify(after))
        throw Error('STALE_REVISION: Editor switched during context query');
    const ctx = { generation: changeGeneration, document: url || 'none', documentId: uuid || null, rootId: tree && tree.uuid, stage: !url ? 'none' : url.endsWith('.prefab') ? 'prefab' : url.endsWith('.scene') ? 'scene' : 'none', dirty: !!dirty, importing: !ready, assets: {} };
    if (ready && url)
        for (const id of await scene('sources', [ctx]))
            ctx.assets[id] = await Editor.Message.request('asset-db', 'query-url', id);
    return ctx;
}
async function tick() {
    if (running || stopped)
        return;
    running = true;
    try {
        const ctx = await context(), observation = await scene('observe', [ctx]);
        if (!connection)
            connection = await rpc('editor.connect', { root: projectRoot(), creatorVersion: creatorVersion(), engineVersion: observation.engineVersion, instance, features: observation.features, state: observation.state });
        else
            await rpc('editor.heartbeat', { ...credentials(), state: observation.state });
        for (const job of await rpc('editor.poll', credentials())) {
            let response;
            try {
                const fresh = await context();
                const mutation=job.command.startsWith('mutation.');
                response = { id: job.id, ...await scene(mutation?'mutate':'read', [fresh, job]) };
                if(job.command==='mutation.apply') {
                    const after=await context(),observed=await scene('observe',[after]);
                    response.data.state=observed.state;
                }
            }
            catch (e) {
                response = { id: job.id, revision: job.revision, error: String(e.message || e).slice(0, 500) };
            }
            await rpc('editor.respond', { ...credentials(), response });
        }
    }
    catch (e) {
        connection = null;
        console.warn('[cocos-ai-bridge] ' + String(e.message || e));
    }
    finally {
        running = false;
    }
}
function credentials() { return { session: connection.session, lease: connection.lease }; }
exports.load = () => {
    stopped = false;
    const config = path.join(__dirname, 'config.json');
    if (!fs.existsSync(config)) {
        console.info('[cocos-ai-bridge] No local config; bridge disabled');
        return;
    }
    configuration = JSON.parse(fs.readFileSync(config, 'utf8'));
    timer = setInterval(tick, 1000);
};
exports.unload = () => {
    stopped = true;
    clearInterval(timer);
    if (connection)
        void rpc('editor.disconnect', credentials()).catch(() => { });
    connection = null;
};
exports.methods = { changed: () => { changeGeneration++; },
    status: () => ({ connected: !!connection, session: connection && connection.session }) };

exports.messages={'scene:ready':exports.methods.changed,'scene:saved':exports.methods.changed,'scene:reloading':exports.methods.changed,'scene:change-node':exports.methods.changed,'scene:change-component':exports.methods.changed};
