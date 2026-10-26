'use strict';
const { isProxy } = require('util').types;
const crypto = require('crypto');
if (typeof isProxy !== 'function')
    throw Error('Proxy detection unavailable; read adapter disabled');
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const unsafe = object => object !== null && (typeof object === 'object' || typeof object === 'function') && isProxy(object);
function descriptor(object, key) { for (let p = object; p;) {
    if (unsafe(p))
        return undefined;
    const d = Object.getOwnPropertyDescriptor(p, key);
    if (d)
        return d;
    p = Object.getPrototypeOf(p);
} return undefined; }
function data(object, key) { const d = object && descriptor(object, key); return d && hasOwn(d, 'value') ? d.value : undefined; }
function keys(object) { return object && !unsafe(object) ? Object.keys(object) : []; }
function arrayData(array) { if (unsafe(array) || !Array.isArray(array))
    return []; const length = data(array, 'length'); if (length > 10000)
    throw Error('RESOURCE_LIMIT: metadata array exceeds 10000 entries'); const result = []; for (let i = 0; i < length; i++) {
    const d = Object.getOwnPropertyDescriptor(array, String(i));
    result.push(d && hasOwn(d, 'value') ? d.value : undefined);
} return result; }
function nameOf(cc, ctor) { if (unsafe(ctor))
    return 'unavailable-proxy'; if (typeof ctor !== 'function')
    return 'unknown'; const prototype = data(ctor, 'prototype'); const tag = prototype && !unsafe(prototype) && Object.getOwnPropertyDescriptor(prototype, '__classname__'); return tag && typeof tag.value === 'string' && tag.value ? tag.value : data(ctor, 'name') || 'unregistered'; }
function classes(cc) { const set = new Set(); for (const key of ['_nameToClass', '_idToClass', '_registeredClassNames', '_registeredClassIds']) {
    const map = cc.js[key] || (!cc.js._nameToClass && cc.js.js && cc.js.js[key]);
    for (const key of keys(map)) {
        const ctor = data(map, key);
        if (typeof ctor === 'function' && !unsafe(ctor))
            set.add(ctor);
    }
} return [...set].sort((a, b) => nameOf(cc, a).localeCompare(nameOf(cc, b))); }
function lineage(ctor) { const result = []; for (let c = ctor; typeof c === 'function' && c !== Function.prototype && !unsafe(c); c = Object.getPrototypeOf(c))
    result.push(c); return result; }
function attributeKeys(attrs) { const out = new Set(); for (let a = attrs; a && !unsafe(a); a = Object.getPrototypeOf(a))
    for (const k of keys(a))
        out.add(k); return [...out]; }
function fieldsOf(ctor) { const out = new Set(); for (const c of lineage(ctor).reverse()) {
    for (const p of arrayData(data(c, '__props__')))
        if (typeof p === 'string')
            out.add(p);
    for (const key of attributeKeys(data(c, '__attrs__')))
        if (key.includes('$_$'))
            out.add(key.split('$_$')[0]);
} return [...out]; }
function meta(ctor, field, key) { for (const c of lineage(ctor)) {
    const attrs = Object.getOwnPropertyDescriptor(c, '__attrs__')?.value;
    const d = attrs && descriptor(attrs, field + '$_$' + key);
    if (d && hasOwn(d, 'value'))
        return d.value;
} return undefined; }
function owner(cc, ctor, field) { for (const c of lineage(ctor)) {
    const attrs = Object.getOwnPropertyDescriptor(c, '__attrs__')?.value;
    if (keys(attrs).some(k => k.startsWith(field + '$_$')))
        return nameOf(cc, c);
} return nameOf(cc, ctor); }
function list(value) { if (unsafe(value))
    return [{ unavailable: 'proxy' }]; if (!Array.isArray(value))
    return undefined; const result = []; for (const x of arrayData(value)) {
    if (!x || unsafe(x)) {
        result.push({ unavailable: unsafe(x) ? 'proxy' : 'accessor-or-hole' });
        continue;
    }
    const name = data(x, 'name'), n = data(x, 'value');
    result.push(typeof name === 'string' && typeof n === 'number' ? { name, value: n } : { unavailable: 'metadata-accessor-or-type' });
} return result; }
function arrayShape(value) { if (unsafe(value))
    return 'unknown'; if (Array.isArray(value))
    return true; if (typeof value !== 'function')
    return false; const text = Function.prototype.toString.call(value); return /^\s*(?:function\s*[^()]*\(\s*\)\s*\{\s*return\s*\[\s*\]\s*;?\s*\}|\(\s*\)\s*=>\s*\[\s*\])\s*$/.test(text) ? true : 'unknown'; }
function isInstance(object, ctor) { if (unsafe(object) || unsafe(ctor) || typeof ctor !== 'function')
    return false; const target = data(ctor, 'prototype'); for (let p = object; p && !unsafe(p); p = Object.getPrototypeOf(p))
    if (p === target)
        return true; return false; }
function opaque(name, reason) { return { name, fields: [], reason, coverage: { inventory: 'opaque', read: false, roundtrip: false, write: false } }; }
function defaultEvidence(v, depth = 0) { if (unsafe(v))
    return { unavailable: 'proxy' }; if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    return v; if (typeof v === 'undefined')
    return { kind: 'undefined' }; if (typeof v === 'function')
    return { kind: 'factory-not-evaluated', hash: crypto.createHash('sha256').update(Function.prototype.toString.call(v)).digest('hex') }; if (depth > 3)
    return { unavailable: 'metadata-budget' }; if (Array.isArray(v))
    return arrayData(v).slice(0, 100).map(x => defaultEvidence(x, depth + 1)); const result = {}; for (const key of keys(v).slice(0, 100)) {
    const d = descriptor(v, key);
    result[key] = d && hasOwn(d, 'value') ? defaultEvidence(d.value, depth + 1) : { unavailable: 'accessor' };
} return result; }
function describeType(cc, ctor) {
    if (unsafe(ctor))
        return opaque('unavailable-proxy', 'proxy');
    if (typeof ctor !== 'function')
        return opaque('missing-script', 'missing-constructor');
    const name = nameOf(cc, ctor);
    if (name === 'cc.MissingScript' || name === 'MissingScript')
        return opaque(name, 'missing-script-native-payload-retained-in-engine');
    const fields = fieldsOf(ctor).map(name => { const get = key => meta(ctor, name, key), defaultValue = get('default'), typeCtor = get('ctor'), type = get('type'); return { name, default: defaultEvidence(defaultValue), owner: owner(cc, ctor, name), type: typeof typeCtor === 'function' ? nameOf(cc, typeCtor) : typeof type === 'string' ? type : 'unknown', nullable: defaultValue === undefined ? 'unknown' : defaultValue === null, array: arrayShape(defaultValue), serializable: get('serializable') !== false, editorOnly: get('editorOnly') === true, visible: typeof get('visible') === 'boolean' ? get('visible') : 'dynamic-or-default', readonly: get('readonly') === true, formerlySerializedAs: typeof get('formerlySerializedAs') === 'string' ? get('formerlySerializedAs') : undefined, enum: list(get('enumList')), bitmask: list(get('bitmaskList')), backingField: name }; });
    return { name, kind: cc.Component && (ctor === cc.Component || isInstance(data(ctor, 'prototype'), cc.Component)) ? 'component' : 'registered-class', base: nameOf(cc, Object.getPrototypeOf(ctor)), fields, coverage: { inventory: 'registered', read: 'own-data-only', roundtrip: false, write: false } };
}
function inventory(cc) { const all = classes(cc); return { total: all.length, classes: all.map(c => ({ name: nameOf(cc, c), component: c === cc.Component || isInstance(data(c, 'prototype'), cc.Component), fieldCount: fieldsOf(c).length })), coverage: { inventory: 'actual-registered-constructors', read: 'own-data-only', roundtrip: false, write: false } }; }
function readProperties(cc, object, schema, refs = new Map(), observe = () => { }) {
    if (unsafe(object))
        return { $unavailable: 'proxy' };
    if (schema.coverage && schema.coverage.inventory === 'opaque')
        return { $unavailable: 'opaque-missing-script' };
    const seen = new Map();
    let count = 0, budget = 20000;
    const scope = refs.get(object) || 'value';
    function value(v, depth = 0) {
        if (unsafe(v))
            return { $unavailable: 'proxy' };
        if (--budget < 0 || depth > 12)
            return { $unavailable: 'value-budget' };
        if (v === null || typeof v === 'string' || typeof v === 'boolean')
            return v;
        if (typeof v === 'number')
            return Number.isFinite(v) ? v : { $number: String(v) };
        if (typeof v !== 'object')
            return { $unavailable: typeof v };
        observe(v);
        if (refs.has(v))
            return { $ref: refs.get(v) };
        if (seen.has(v))
            return { $ref: seen.get(v) };
        const id = scope + '/#value:' + (++count);
        seen.set(v, id);
        if (Array.isArray(v)) {
            if (v.length > 1000)
                return { $value: id, $unavailable: 'array-budget', length: v.length };
            const items = [];
            for (let i = 0; i < v.length; i++) {
                const d = Object.getOwnPropertyDescriptor(v, String(i));
                items.push(!d ? { $unavailable: 'hole' } : hasOwn(d, 'value') ? value(d.value, depth + 1) : { $unavailable: 'accessor' });
            }
            return { $value: id, items };
        }
        if (isInstance(v, cc.Node) || isInstance(v, cc.Component) || isInstance(v, cc.Asset))
            return { $unavailable: 'external-reference', type: nameOf(cc, data(v, 'constructor')) };
        const names = keys(v), result = { $value: id };
        if (names.length > 100)
            result.$omittedKeys = names.length - 100;
        for (const key of names.slice(0, 100)) {
            const d = Object.getOwnPropertyDescriptor(v, key);
            result[key] = d && hasOwn(d, 'value') ? value(d.value, depth + 1) : { $unavailable: 'accessor' };
        }
        return result;
    }
    const result = Object.create(null);
    for (const field of schema.fields) {
        if (['_id', '_uuid', '__prefab', '_prefab', '__scriptAsset', '__editorExtras__', '_$erialized'].includes(field.name)) {
            result[field.name] = { status: 'native-metadata-omitted' };
            continue;
        }
        const d = descriptor(object, field.backingField);
        result[field.name] = !d ? { status: 'absent', type: field.type } : !hasOwn(d, 'value') ? { status: 'unavailable-accessor', type: field.type } : { status: 'read', type: field.type, value: value(d.value) };
    }
    return result;
}
module.exports = { descriptor, data, keys, arrayData, isInstance, nameOf, classes, describeType, inventory, readProperties };
