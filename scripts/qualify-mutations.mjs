import { mkdir, writeFile, readFile, cp, rm, open, unlink, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { startServer } from '../dist/daemon/server.js';
import { createRequest } from '../dist/contracts/index.js';
import { approveProposal } from '../dist/mutation/policy.js';
const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), project = path.join(kit, '.superpowers/p5-creator-project-' + Date.now()), evidence = path.join(kit, 'docs/testing/evidence/p5');
await mkdir(project, { recursive: true });
await mkdir(evidence, { recursive: true });
const lockFile = path.join(project, 'qualification.lock'), lock = await open(lockFile, 'wx', 0o600);
await lock.writeFile(String(process.pid));
const stateDir = path.join(project, 'kit-state'), server = await startServer({ stateDir });
const registered = await server.dispatch(createRequest('project.register', { root: project }));
if (registered.status !== 'ok')
    throw Error(JSON.stringify(registered));
const projectId = registered.data.id;
for (const file of ['KitFixture.ts', 'KitFixtureBase.ts']) {
    await mkdir(path.join(project, 'assets'), { recursive: true });
    await cp(path.join(kit, 'tests/fixtures/editor', file), path.join(project, 'assets', file));
}
await mkdir(path.join(project, 'settings/v2/packages'), { recursive: true });
await writeFile(path.join(project, 'settings/v2/packages/scene.json'), JSON.stringify({ scene: { 'native-engine': false } }));
await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'p5-qualification', uuid: 'f1a0eddb-7c8b-47a5-a95c-4390a847988b', creator: { version: '3.7.3' } }));
const extension = path.join(project, 'extensions/cocos-ai-bridge'), probe = path.join(project, 'extensions/p5-probe');
await cp(path.join(kit, 'extensions/cocos-ai-bridge'), extension, { recursive: true });
await writeFile(path.join(extension, 'config.json'), JSON.stringify({ endpoint: path.join(stateDir, 'endpoint.json'), projectId }));
await mkdir(probe, { recursive: true });
await writeFile(path.join(probe, 'package.json'), JSON.stringify({ name: 'p5-probe', version: '1.0.0', package_version: 2, main: 'main.cjs', contributions: { scene: { script: 'scene.cjs' } } }));
await cp(path.join(kit, 'tests/fixtures/editor/mutation-main.cjs'), path.join(probe, 'main.cjs'));
const fixtureSource = await readFile(path.join(kit, 'tests/fixtures/editor/qualification-scene.cjs'), 'utf8');
await writeFile(path.join(probe, 'scene.cjs'), fixtureSource.replace('panel.addComponent(cc.UITransform);','panel.addComponent(cc.UITransform);panel.addComponent(cc.UIOpacity);') + `
const identityMap=new WeakMap(),randomBytes=require('crypto').randomBytes;
exports.methods.fixtureIdentity=()=>{const root=globalThis.cce.Scene.rootNode;if(!root)return null;if(!identityMap.has(root))identityMap.set(root,randomBytes(16).toString('hex'));return identityMap.get(root);};
exports.methods.reloadFixture=()=>{void globalThis.cce.SceneFacadeManager.reloadScene();return {started:true};};
`);
await rm(path.join(project, 'p5-ready.json'), { force: true });
const binary = process.env.COCOS_CREATOR_EXECUTABLE || '/Applications/Cocos/Creator/3.7.3/CocosCreator.app/Contents/MacOS/CocosCreator';
const child = spawn(binary, ['--project', project, '--nologin'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
await writeFile(path.join(evidence, 'creator.log'), '');
for (const s of [child.stdout, child.stderr])
    s.on('data', b => void appendFile(path.join(evidence, 'creator.log'), b));
child.on('error', e => console.error(e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wait(fn, ms = 120000) { const begin = Date.now(); while (Date.now() - begin < ms) {
    const r = await fn();
    if (r)
        return r;
    await sleep(400);
} throw Error('Qualification timeout'); }
const run = (op, params = {}, extra = {}) => server.dispatch(createRequest(op, params, { projectId, ...extra }));
const ok = r => { if (r.status !== 'ok')
    throw Error(JSON.stringify(r)); return r.data; };
async function current() { return (await run('editor.sessions')).data?.find(s => s.state.stage === 'scene' && !s.state.importing && s.features.mutationV1); }
async function query() { for (let i = 0; i < 10; i++) {
    const s = await current(); if(!s){await sleep(400);continue;} const r = await run('editor.query', { command: 'scene.capture' }, { source: 'editor', session: s.session });
    if (r.status === 'error' && ['STALE_REVISION','STALE_HANDLE','UNAVAILABLE_CAPABILITY'].includes(r.error.code)) {
        await sleep(500);
        continue;
    }
    const data = ok(r);
    return { meta: data, tree: server.snapshots.get(data.snapshot).data };
} throw Error('Unstable scene'); }
async function propose(steps, operation = 'editor.propose', params) { for (let i = 0; i < 10; i++) {
    const s = await current(), r = await run(operation, params || { steps, scope: 'scene-instance', save: false }, { source: 'editor', session: s.session, revision: s.state.revision });
    if (r.status === 'error' && r.error.code === 'STALE_REVISION') {
        await sleep(500);
        continue;
    }
    return { proposal: ok(r), session: s.session };
} throw Error('Unstable proposal'); }
async function apply(p) { await approveProposal(stateDir, p.proposal.id, p.proposal.hash); return ok(await run('editor.apply', { proposal: p.proposal.id, idempotencyKey: p.proposal.id }, { source: 'editor', session: p.session })); }
async function command(command) { const id = randomUUID(); await writeFile(path.join(project, 'p5-command.json'), JSON.stringify({ id, command })); return wait(async () => { try {
    return JSON.parse(await readFile(path.join(project, 'p5-result-' + id + '.json'), 'utf8')).result;
}
catch {
    return null;
} }); }
let report;
try {
    await wait(async () => { try {
        await readFile(path.join(project, 'p5-ready.json'));
        return await current();
    }
    catch {
        return null;
    } });
    const before = await query(), diskBefore = await readFile(path.join(project, 'assets/Qualification.scene'), 'utf8'), panel = before.tree.find(n => n.name === 'Panel'), hidden = before.tree.find(n => n.name === 'Hidden'), button = panel.components.find(c => c.type === 'cc.Button');
    if (!panel || !hidden || !button)
        throw Error('Synthetic fixture missing');
    const prop = await propose([{ operation: 'property.set', target: panel.path, field: 'position', expected: { x: 0, y: 0, z: 0 }, value: { x: 87, y: 21, z: 0 } }]);
    if (await readFile(path.join(project, 'assets/Qualification.scene'), 'utf8') !== diskBefore)
        throw Error('Proposal wrote disk');
    const afterProposal=await query(); if(JSON.stringify(afterProposal.tree)!==JSON.stringify(before.tree)||afterProposal.meta.state.dirty!==before.meta.state.dirty)throw Error('Proposal changed Editor state');
    const unapproved=await run('editor.apply',{proposal:prop.proposal.id,idempotencyKey:prop.proposal.id},{source:'editor',session:prop.session});if(unapproved.error?.code!=='AUTHORIZATION_REQUIRED')throw Error('Unapproved native write accepted');
    const applied = await apply(prop);
    if (applied.status !== 'applied')
        throw Error(JSON.stringify(applied));
    const replay=ok(await run('editor.apply',{proposal:prop.proposal.id,idempotencyKey:prop.proposal.id},{source:'editor',session:prop.session}));if(JSON.stringify(replay)!==JSON.stringify(applied))throw Error('Native idempotent replay differs');
    const after = await query();
    if (after.tree.find(n => n.name === 'Panel').position.value.x !== 87)
        throw Error('Property read-back differs');
    if (await readFile(path.join(project, 'assets/Qualification.scene'), 'utf8') !== diskBefore)
        throw Error('save=false changed source');
    const inspect = await command('inspect');
    if (!inspect.dirty)
        throw Error('Owner setter did not dirty Editor');
    await command('undo');
    await wait(async () => { const q = await query(); return q.tree.find(n => n.name === 'Panel').position.value.x === 0; });
    await command('redo');
    await wait(async () => { const q = await query(); return q.tree.find(n => n.name === 'Panel').position.value.x === 87; });
    const ui=panel.components.find(c=>c.type==='cc.UITransform'),opacity=panel.components.find(c=>c.type==='cc.UIOpacity');
    if(!ui||!opacity)throw Error('UI fixture adapters missing');
    const uiProposal=await propose([
        {operation:'property.set',target:ui.path,field:'width',expected:ui.properties._contentSize.value.width,value:320},
        {operation:'property.set',target:ui.path,field:'height',expected:ui.properties._contentSize.value.height,value:180},
        {operation:'property.set',target:opacity.path,field:'opacity',expected:255,value:128},
        {operation:'property.set',target:button.path,field:'interactable',expected:true,value:false},
        {operation:'property.set',target:panel.path,field:'active',expected:true,value:false}
    ]),uiApplied=await apply(uiProposal);
    if(uiApplied.status!=='applied')throw Error(JSON.stringify(uiApplied));
    const uiRestore=await apply(await propose([
        {operation:'property.set',target:panel.path,field:'active',expected:false,value:true},
        {operation:'property.set',target:button.path,field:'interactable',expected:false,value:true},
        {operation:'property.set',target:opacity.path,field:'opacity',expected:128,value:255},
        {operation:'property.set',target:ui.path,field:'height',expected:180,value:ui.properties._contentSize.value.height},
        {operation:'property.set',target:ui.path,field:'width',expected:320,value:ui.properties._contentSize.value.width}
    ]));
    if(uiRestore.status!=='applied')throw Error('UI inverse failed');
    const reference = await propose([{ operation: 'reference.bind', target: button.path, field: 'target', expected: { path: hidden.path }, value: null }]), bound = await apply(reference);
    if (bound.status !== 'applied')
        throw Error(JSON.stringify(bound));
    const restoredProposal = await propose([], 'editor.rollback.propose', { checkpoint: bound.checkpoint }), restored = await apply(restoredProposal);
    if (restored.status !== 'applied')
        throw Error('Inverse failed');
    const rename = await propose([{ operation: 'node.rename', target: panel.path, field: 'name', expected: 'Panel', value: 'RenamedPanel' }]), renamed = await apply(rename);
    if (renamed.status !== 'applied')
        throw Error(JSON.stringify(renamed));
    await command('save-scene');
    const saved = await readFile(path.join(project, 'assets/Qualification.scene'), 'utf8');
    if (saved === diskBefore || !saved.includes('RenamedPanel'))
        throw Error('Save not persisted');
    const reloadEvidence = await command('reload');
    if (reloadEvidence.before === reloadEvidence.after)
        throw Error('Reload did not replace scene identity');
    const reload = await query(), loaded = reload.tree.find(n => n.name === 'RenamedPanel');
    if (!loaded || loaded.position.value.x !== 87 || loaded.components.find(c => c.type === 'cc.Button').properties._target.value.$ref !== loaded.path + '/Hidden[0]')
        throw Error('Reload/reference integrity failed');
    report = { phase: 'P5', status: 'PASS_SCOPED', creator: '3.7.3', platform: process.platform, arch: process.arch, project: 'standalone synthetic only', property: applied, uiProperties:uiApplied, uiRestoreFromFreshProposal:uiRestore, reference: bound, inverse: restored, rename: renamed, undoRedo: true,unapprovedNativeRefused:true,idempotentReplay:true, proposalNoDiskWrite: true,proposalNoEditorWrite:true, saveFalseNoDiskWrite: true, explicitSaveReload: true, reloadReplacedOwnerIdentity: true, nativeInspectorDirty: inspect.dirty, limits: ['Windows not run', 'Only qualified public fields on plain scene instances', 'Nested prefab/add/remove/reparent/array/asset/source mutations unavailable', 'No visual/gameplay correctness claim'], timestamp: new Date().toISOString() };
}
catch (e) {
    report = { phase: 'P5', status: 'FAIL', error: String(e.stack || e) };
    process.exitCode = 1;
}
finally {
    child.kill('SIGTERM');
    await new Promise(resolve => { if (child.exitCode !== null)
        return resolve(); child.once('exit', resolve); const timer = setTimeout(() => child.kill('SIGKILL'), 3000); timer.unref(); });
    await server.close();
    await lock.close();
    await unlink(lockFile);
    await writeFile(path.join(evidence, 'creator-report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, error: report.error }));
