'use strict';
const cc = require('cc'), crypto = require('crypto');
const reflection = require('./reflection');
const { data, nameOf } = reflection;
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const generation = crypto.randomBytes(12).toString('hex');
const identities = new WeakMap();
let identityCount = 0;
function identity(object) {
    if (!object)
        return null;
    if (!identities.has(object))
        identities.set(object, ++identityCount);
    return identities.get(object);
}
function registry() { const constructors = reflection.classes(cc), schemas = constructors.map(c => reflection.describeType(cc, c)); return { constructors, schemas, hash: hash({ schemas, constructors: constructors.map(identity) }) }; }
function activeRoot(context = {}) { const scene = cc.director.getScene(); if (!context.rootId)
    return scene; const manager = globalThis.EditorExtends && globalThis.EditorExtends.Node; if (manager && typeof manager.getNodesInScene === 'function') {
    const root = data(manager.getNodesInScene(), context.rootId);
    if (root)
        return root;
} const stack = scene ? [scene] : [], seen = new Set(); while (stack.length) {
    const n = stack.pop();
    if (seen.has(n))
        continue;
    seen.add(n);
    if (seen.size > 10000)
        throw Error('RESOURCE_LIMIT: root lookup budget');
    if (data(n, '_id') === context.rootId)
        return n;
    for (const child of reflection.arrayData(data(n, '_children')))
        if (child)
            stack.push(child);
} throw Error('STALE_REVISION: active Editor tree root no longer exists'); }
function capture(context, observed = [], bindings) {
    const root = activeRoot(context);
    if (!root)
        return [];
    let excluded = 0;
    const watch = object => observed.push(identity(object));
    const nodes = [], refs = new Map(), seen = new Set(), stack = [{ node: root, path: '/' + encodeURIComponent(data(root, '_name') || 'Scene') + '[0]' }];
    while (stack.length) {
        const item = stack.pop(), node = item.node;
        if (node !== root && ((data(node, '_objFlags') || 0) & 8)) {
            excluded++;
            continue;
        }
        if (seen.has(node))
            throw Error('Hierarchy cycle');
        seen.add(node);
        if (nodes.length >= 10000)
            throw Error('Node budget exceeded');
        nodes.push(item);
        refs.set(node, item.path);
        const components = data(node, '_components') || [];
        components.forEach((c, i) => {
            if (c)
                refs.set(c, item.path + '/@' + encodeURIComponent(nameOf(cc, data(c, 'constructor'))) + '[' + i + ']');
        });
        const children = data(node, '_children') || [];
        for (let i = children.length - 1; i >= 0; i--)
            stack.push({ node: children[i], path: item.path + '/' + encodeURIComponent(data(children[i], '_name') || '') + '[' + i + ']' });
    }
    if (bindings) for (const [object, path] of refs) bindings.set(path, object);
    return nodes.map(({ node, path }) => {
        const components = (data(node, '_components') || []).map((c, i) => { const schema = reflection.describeType(cc, c && data(c, 'constructor')); return { path: c ? refs.get(c) : path + '/@missing[' + i + ']', type: schema.name, enabled: c ? data(c, '_enabled') : null, properties: c ? reflection.readProperties(cc, c, schema, refs, watch) : {}, coverage: schema.coverage }; });
        const chain = [];
        const seenRoots = new Set();
        for (let current = node; current; current = data(current, '_parent')) {
            const info = data(current, '_prefab');
            if (!info)
                continue;
            const prefabRoot = data(info, 'root');
            if (!prefabRoot || seenRoots.has(prefabRoot))
                continue;
            seenRoots.add(prefabRoot);
            const instance = data(info, 'instance'), asset = data(info, 'asset'), uuid = data(asset, '_uuid');
            const source = context.assets && context.assets[uuid];
            const target = t => {
                let value = data(instance, 'targetMap');
                for (const id of data(t, 'localID') || [])
                    value = data(value, id);
                return refs.get(value) || null;
            };
            chain.unshift({ instanceRoot: refs.get(prefabRoot) || null, source: source || null, sourceStatus: source ? 'resolved' : 'unresolved', overrides: (data(instance, 'propertyOverrides') || []).map(o => ({ target: target(data(o, 'targetInfo')), propertyPath: data(o, 'propertyPath'), owner: refs.get(prefabRoot) || null })), mountedComponents: (data(instance, 'mountedComponents') || []).map(m => ({ target: target(data(m, 'targetInfo')), components: (data(m, 'components') || []).map(c => refs.get(c) || null) })), removedComponents: (data(instance, 'removedComponents') || []).map(target) });
        }
        return { inventory: node === root ? { scope: 'editor-document', excludedDontSaveSubtrees: excluded } : undefined, path, kind: 'node', name: data(node, '_name'), active: data(node, '_active'), position: reflection.readProperties(cc, node, { fields: [{ name: 'position', backingField: '_lpos', type: 'cc.Vec3' }] }, refs).position, transform: reflection.readProperties(cc, node, { fields: ['_lrot', '_lscale', '_euler', '_layer', '_mobility'].map(name => ({ name, backingField: name, type: 'owner-data' })) }, refs), properties: reflection.readProperties(cc, node, reflection.describeType(cc, data(node, 'constructor')), refs, watch), components, provenance: { state: 'owner-process-observation', instanceChain: chain, serializedValuesIncluded: false, effectiveValues: true, write: false } };
    });
}
function sources(context = {}) {
    const root = activeRoot(context), out = new Set(), stack = root ? [root] : [], seen = new Set();
    while (stack.length) {
        const n = stack.pop();
        if (seen.has(n))
            continue;
        seen.add(n);
        if (seen.size > 10000)
            throw Error('Node budget exceeded');
        const uuid = data(data(data(n, '_prefab'), 'asset'), '_uuid');
        if (typeof uuid === 'string')
            out.add(uuid);
        stack.push(...(data(n, '_children') || []));
    }
    return [...out];
}
function observe(context) {
    const active = activeRoot(context);
    if ((context.rootId || context.documentId) && active && data(active, '_id') !== (context.rootId || context.documentId))
        throw Error('STALE_REVISION: active document differs from main-process context');
    const r = registry(), observed = [], tree = capture(context, observed);
    const root = activeRoot(context);
    return { engineVersion: cc.ENGINE_VERSION || cc.VERSION || globalThis.CocosEngine || (globalThis.cc && globalThis.cc.ENGINE_VERSION), features: { scene: typeof cc.director.getScene === 'function', registry: !!(cc.js._nameToClass || cc.js._registeredClassNames || (cc.js.js && cc.js.js._registeredClassNames)), attributes: !!data(cc.Node, '__attrs__'), mutationV1: !!historyFacade() }, state: { document: context.document, stage: root ? context.stage : 'none', revision: hash({ generation, root: identity(root), context, tree, observed, schema: r.hash }), schema: r.hash, dirty: context.dirty, importing: context.importing }, counts: { classes: r.schemas.length, nodes: tree.length } };
}
function historyFacade() { try { const facade=globalThis.cce&&globalThis.cce.SceneFacadeManager&&globalThis.cce.SceneFacadeManager.getCurrentFacade(); return facade&&typeof facade.recordNode==='function'&&typeof facade.snapshot==='function'?facade:null; } catch { return null; } }
let mutations;
function mutationAdapter() {
    if(!mutations) mutations=require('./approval/mutation.cjs').createMutationAdapter({cc,observe,
        bindings(context){const map=new Map();capture(context,[],map);return map;},
        fingerprint(context){const ids=[],tree=capture(context,ids);return hash({tree,ids,schema:registry().hash});},
        history:historyFacade});
    return mutations;
}
exports.methods = {
    sources,
    observe,
    mutate(context,job) {
        const adapter=mutationAdapter();
        if(job.command==='mutation.prepare') return {revision:job.revision,data:adapter.prepare(context,job)};
        if(job.command==='mutation.rollback.prepare') return {revision:job.revision,data:adapter.rollbackPrepare(context,job)};
        if(job.command==='mutation.apply') return {revision:job.revision,data:adapter.apply(context,job)};
        throw Error('UNSUPPORTED_OPERATION: mutation command not allowlisted');
    },
    read(context, job) {
        const before = observe(context);
        if (job.revision !== before.state.revision)
            throw Error('STALE_REVISION: scene changed before read');
        let result;
        if (job.command === 'scene.capture')
            result = capture(context);
        else {
            const r = registry();
            if (job.params.schema && job.params.schema !== r.hash)
                throw Error('STALE_REVISION: schema changed');
            if (job.command === 'schema.list') {
                const offset = job.params.offset || 0, limit = job.params.limit || 25;
                if (offset > r.schemas.length)
                    throw Error('Schema offset out of range');
                result = { schema: r.hash, total: r.schemas.length, classes: r.schemas.slice(offset, offset + limit).map(s => ({ name: s.name, base: s.base, component: s.kind === 'component', fieldCount: s.fields.length, coverage: s.coverage })), nextOffset: offset + limit < r.schemas.length ? offset + limit : null };
            }
            else if (job.command === 'schema.describe') {
                const matches = r.schemas.filter(s => s.name === job.params.type);
                if (matches.length !== 1)
                    throw Error((matches.length ? 'AMBIGUOUS_TARGET' : 'NOT_FOUND') + ': Type missing or ambiguous');
                result = { schema: r.hash, type: matches[0] };
            }
            else
                throw Error('Unsupported read command');
        }
        if (Buffer.byteLength(JSON.stringify(result)) > 800000)
            throw Error('RESOURCE_LIMIT: request smaller projection');
        return { revision: before.state.revision, data: result };
    }
};
for (const key of Object.keys(exports.methods)) {
    const original = exports.methods[key];
    exports.methods[key] = function (...args) {
        try {
            return original(...args);
        }
        catch (error) {
            console.error('[cocos-ai-bridge scene ' + key + '] ' + String(error.stack || error));
            throw error;
        }
    };
}
