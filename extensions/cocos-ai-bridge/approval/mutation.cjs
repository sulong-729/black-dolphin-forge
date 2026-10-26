'use strict';
const { randomBytes } = require('crypto');
const randomUUID = () => randomBytes(16).toString('hex');
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (code, message) => { throw Error(code + ': ' + message); };
const finite = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7;
function createMutationAdapter({ cc, observe, bindings, fingerprint, history, clock = Date.now }) {
    const plans = new Map(), receipts = new Map();
    const sweep = () => { for (const [id, p] of plans)
        if (clock() >= p.expires)
            plans.delete(id); for (const [id, p] of receipts)
        if (clock() >= p.expires)
            receipts.delete(id); };
    function ready(context, job) { if (context.stage !== 'scene' || context.importing)
        fail('UNSUPPORTED_OPERATION', 'Only ready plain scene-instance scope'); const state = observe(context).state; if (state.revision !== job.revision)
        fail('STALE_REVISION', 'Owner revision changed before command'); return state; }
    function plain(node) { const seen = new Set(); for (let p = node; p; p = p.parent || p._parent) {
        if (seen.has(p) || seen.size >= 10000)
            fail('INTEGRITY_ERROR', 'Invalid ancestor chain');
        seen.add(p);
        if (p._prefab)
            fail('UNSUPPORTED_OPERATION', 'Prefab ownership requires a qualified prefab adapter');
    } }
    function fieldInfo(object, field, map) {
        const ctor = object && object.constructor;
        let fields = [];
        if (ctor === cc.Node)
            fields = ['name', 'active', 'position'];
        else if (cc.Button && ctor === cc.Button)
            fields = ['interactable', 'target'];
        else if (cc.UITransform && ctor === cc.UITransform)
            fields = ['width', 'height'];
        else if (cc.UIOpacity && ctor === cc.UIOpacity)
            fields = ['opacity'];
        if (!fields.includes(field))
            fail('UNSUPPORTED_OPERATION', 'Unqualified component/property ' + field);
        const node = ctor === cc.Node ? object : object.node;
        plain(node);
        const paths = new Map([...map].map(([p, o]) => [o, p]));
        const read = () => field === 'position' ? { x: object.position.x, y: object.position.y, z: object.position.z } : field === 'target' ? (() => { const target = own(object, '_target') ? object._target : object.target; return target === null ? null : paths.has(target) ? { path: paths.get(target) } : fail('UNSUPPORTED_OPERATION', 'Reference outside captured owner'); })() : object[field];
        function validate(value) {
            if (field === 'position') {
                if (!value || !equal(Object.keys(value).sort(), ['x', 'y', 'z']) || ![value.x, value.y, value.z].every(finite))
                    fail('SCHEMA_MISMATCH', 'position requires finite x/y/z');
                return new cc.Vec3(value.x, value.y, value.z);
            }
            if (field === 'target') {
                if (value === null)
                    return null;
                if (!value || !equal(Object.keys(value), ['path']) || typeof value.path !== 'string')
                    fail('SCHEMA_MISMATCH', 'Node reference requires path or null');
                const target = map.get(value.path);
                if (!target)
                    fail('NOT_FOUND', 'Reference target not found');
                if (target.constructor !== cc.Node)
                    fail('SCHEMA_MISMATCH', 'Button.target requires cc.Node');
                plain(target);
                return target;
            }
            if (field === 'name') {
                if (typeof value !== 'string' || !value || value.length > 256)
                    fail('SCHEMA_MISMATCH', 'name requires 1..256 characters');
            }
            else if (['active', 'interactable'].includes(field)) {
                if (typeof value !== 'boolean')
                    fail('SCHEMA_MISMATCH', 'Expected boolean');
            }
            else if (!finite(value) || value < 0 || field === 'opacity' && (value > 255 || !Number.isInteger(value)))
                fail('SCHEMA_MISMATCH', 'Numeric value outside qualified range');
            return value;
        }
        return { object, node, read, validate, write: value => { object[field] = validate(value); } };
    }
    function resolve(step, map) { if (!step || !['property.set', 'reference.bind', 'node.rename'].includes(step.operation))
        fail('UNSUPPORTED_OPERATION', 'Operation not allowlisted'); if (!own(step, 'expected') || !own(step, 'value'))
        fail('SCHEMA_MISMATCH', 'Expected/value required'); const object = map.get(step.target); if (!object)
        fail('NOT_FOUND', 'Target not found'); const f = fieldInfo(object, step.field, map); if (step.operation === 'reference.bind' && step.field !== 'target' || step.operation === 'node.rename' && (step.field !== 'name' || object.constructor !== cc.Node) || step.operation === 'property.set' && ['target', 'name'].includes(step.field))
        fail('UNSUPPORTED_OPERATION', 'Use the exact typed operation for this field'); if (!equal(f.read(), step.expected))
        fail('STALE_REVISION', 'Expected-before mismatch at ' + step.target + '/' + step.field); f.validate(step.value); return f; }
    function prepare(context, job) { sweep(); const state = ready(context, job), p = job.params; if (p.scope !== 'scene-instance' || p.save !== false || !Array.isArray(p.steps) || p.steps.length < 1 || p.steps.length > 20)
        fail('SCHEMA_MISMATCH', 'Explicit scope, save=false and 1..20 steps required'); if (p.steps.length > 1 && p.steps.some(s => s.operation === 'node.rename'))
        fail('UNSUPPORTED_OPERATION', 'Rename must be a separate proposal; recapture paths afterwards'); if (plans.size >= 100)
        fail('RESOURCE_LIMIT', 'Owner proposal budget'); const map = bindings(context), seen = new Set(); const fields = p.steps.map(s => { const key = s.target + '\0' + s.field; if (seen.has(key))
        fail('CONFLICT', 'Overlapping selectors'); seen.add(key); return resolve(s, map); }); const id = randomUUID(), preview = JSON.parse(JSON.stringify(p.steps)); plans.set(id, { state, steps: preview, fields, created: clock(), expires: clock() + 300000, fingerprint: fingerprint(context) }); return { ownerPlan: id, preview, scope: 'scene-instance', save: false }; }
    function watch(map) { const out = []; for (const [path, object] of map) {
        const ctor = object.constructor, fields = ctor === cc.Node ? ['active', 'name', 'position'] : ctor === cc.UITransform ? ['width', 'height'] : ctor === cc.UIOpacity ? ['opacity'] : ctor === cc.Button ? ['interactable', 'target'] : [];
        for (const field of fields) {
            try {
                out.push([path + '\0' + field, fieldInfo(object, field, map).read()]);
            }
            catch { }
        }
    } return out; }
    function apply(context, job) {
        sweep();
        const p = job.params;
        if (receipts.has(p.operationId))
            return JSON.parse(JSON.stringify(receipts.get(p.operationId).result));
        const state = ready(context, job), plan = plans.get(p.ownerPlan);
        if (!plan)
            fail('STALE_HANDLE', 'Owner proposal expired');
        if (plan.state.revision !== state.revision || plan.state.schema !== state.schema || plan.state.document !== state.document || plan.fingerprint !== fingerprint(context))
            fail('STALE_REVISION', 'Owner changed since proposal');
        const map = bindings(context), fields = plan.steps.map((s, i) => { const f = resolve(s, map); if (f.object !== plan.fields[i].object)
            fail('STALE_HANDLE', 'Target identity replaced'); return f; });
        const undo = history();
        if (!undo || typeof undo.recordNode !== 'function' || typeof undo.snapshot !== 'function')
            fail('UNAVAILABLE_CAPABILITY', 'Qualified Editor Undo facade unavailable');
        // A receipt is reserved before the first potentially side-effecting call. Reentrant/retry calls cannot replay.
        if (receipts.size >= 100)
            fail('RESOURCE_LIMIT', 'Owner checkpoint budget; wait for expiry');
        const result = { status: 'indeterminate', steps: [], checkpoint: p.operationId, save: false, verification: 'qualified-public-fields', evidence: 'editor-owner' };
        receipts.set(p.operationId, { result, expires: clock() + 300000 });
        plans.delete(p.ownerPlan);
        let attempted = false;
        try {
            const nodes = new Set(fields.map(f => f.node));
            for (const n of nodes) {
                const recorded = undo.recordNode(n, true);
                if (recorded && typeof recorded.then === 'function')
                    fail('UNAVAILABLE_CAPABILITY', 'Async Undo recording is unqualified');
            }
            for (let i = 0; i < fields.length; i++) {
                const s = plan.steps[i], f = fields[i];
                if (!equal(f.read(), s.expected)) {
                    result.steps.push({ index: i, status: 'conflict', reason: 'Expected-before changed during batch' });
                    break;
                }
                const before = watch(map);
                attempted = true;
                f.write(s.value);
                if (!equal(f.read(), s.value)) {
                    result.steps.push({ index: i, status: 'conflict', reason: 'Setter postcondition mismatch' });
                    break;
                }
                result.steps.push({ index: i, status: 'applied', target: s.target, field: s.field, before: s.expected, after: f.read() });
                const live = bindings(context), expectedPaths = new Map([...map].map(([path, object]) => [s.operation === 'node.rename' && (path === s.target || path.startsWith(s.target + '/')) ? s.target.slice(0, s.target.lastIndexOf('/') + 1) + encodeURIComponent(s.value) + s.target.slice(s.target.lastIndexOf('[')) + path.slice(s.target.length) : path, object]));
                if (live.size !== expectedPaths.size || [...expectedPaths].some(([path, object]) => live.get(path) !== object) || observe(context).state.schema !== state.schema) {
                    result.steps.push({ index: i + 1, status: 'conflict', reason: 'Reentrant hierarchy/identity/schema change; remaining steps stopped' });
                    break;
                }
                const after = watch(map), allowed = s.target + '\0' + s.field;
                if (after.some(([key, value]) => key !== allowed && !equal(new Map(before).get(key), value))) {
                    result.steps.push({ index: i + 1, status: 'conflict', reason: 'Reentrant callback changed another qualified field; remaining steps stopped' });
                    break;
                }
            }
            const snapshot = undo.snapshot();
            if (snapshot && typeof snapshot.then === 'function')
                fail('UNAVAILABLE_CAPABILITY', 'Async Undo snapshot unqualified');
            result.status = result.steps.length === fields.length && result.steps.every(s => s.status === 'applied') ? 'applied' : 'partial';
        }
        catch (e) {
            result.status = attempted ? 'indeterminate' : 'rejected';
            result.error = String(e.message || e).slice(0, 500);
        }
        const receipt = receipts.get(p.operationId);
        receipt.after = fingerprint(context);
        receipt.schema = state.schema;
        receipt.document = state.document;
        receipt.steps = plan.steps;
        receipt.identities = fields.map(f => f.object);
        receipt.before = plan.steps.map((s, i) => fields[i].validate(s.expected));
        return JSON.parse(JSON.stringify(result));
    }
    function rollbackPrepare(context, job) { sweep(); ready(context, job); const checkpoint = receipts.get(job.params.checkpoint); if (!checkpoint || checkpoint.result.status !== 'applied')
        fail('UNSUPPORTED_OPERATION', 'Only a fully verified checkpoint can form an inverse proposal'); if (checkpoint.document !== context.document || checkpoint.schema !== observe(context).state.schema || checkpoint.after !== fingerprint(context))
        fail('CONFLICT', 'Owner changed after checkpoint; rollback will not overwrite newer edits'); const map = bindings(context), paths = new Map([...map].map(([p, o]) => [o, p])), inverse = checkpoint.steps.map((s, i) => { const target = paths.get(checkpoint.identities[i]); if (!target)
        fail('CONFLICT', 'Target identity missing'); const field = fieldInfo(checkpoint.identities[i], s.field, map); let value = s.expected; if (s.operation === 'reference.bind' && checkpoint.before[i] !== null) {
        const path = paths.get(checkpoint.before[i]);
        if (!path)
            fail('CONFLICT', 'Original reference identity missing');
        value = { path };
    } return { ...s, target, expected: field.read(), value }; }).reverse(); return prepare(context, { ...job, params: { scope: 'scene-instance', save: false, steps: inverse } }); }
    return { prepare, apply, rollbackPrepare, observe };
}
module.exports = { createMutationAdapter };
