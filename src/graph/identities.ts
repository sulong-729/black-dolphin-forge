import { randomUUID } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
import { escapeSegment } from './paths.js';
import type { Entity, Finding, GraphContext, NativeRecord } from './types.js';
export function identities(data: NativeRecord[], context: GraphContext, revision: string, typeFor: (raw: string) => string) {
    const findings: Finding[] = [], entities: Entity[] = [], slots = new Map<number, Entity>();
    const nodeSlots = data.flatMap((v, i) => ['cc.Node', 'cc.Scene'].includes(v.__type__) ? [i] : []);
    const nodes = new Set(nodeSlots), paths = new Map<number, string>(), parents = new Map<number, number | null>();
    const children = new Map<number | null, number[]>(), names = new Map<number, string>();
    const groups = new Map<number | null, Map<string, number[]>>();
    const issue = (code: string, slot: number, message: string) => findings.push({ code, path: paths.get(slot) || '/unresolved', message });
    for (const i of nodeSlots) {
        const raw = data[i]._parent;
        const valid = raw === undefined || raw === null || typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 1 && Number.isInteger(raw.__id__);
        if (!valid) issue('INVALID_PARENT', i, 'Parent must be a null or integer node reference');
        const parent = valid && raw ? raw.__id__ : null;
        if (parent !== null && !nodes.has(parent)) issue('INVALID_PARENT', i, 'Parent does not resolve to a node');
        parents.set(i, parent);
        const list = children.get(parent) || []; list.push(i); children.set(parent, list);
        const name = String(data[i]._name ?? ''); names.set(i, name);
        const siblings = groups.get(parent) || new Map<string, number[]>();
        const duplicates = siblings.get(name) || []; duplicates.push(i); siblings.set(name, duplicates); groups.set(parent, siblings);
    }
    const segments = new Map<number, string>();
    for (const siblings of groups.values()) for (const [name, list] of siblings) list.forEach((slot, ordinal) => {
        segments.set(slot, escapeSegment(name || '(unnamed)') + (list.length > 1 ? '[' + ordinal + ']' : ''));
    });
    let pathCharacters = 0;
    const setPath = (slot: number, value: string) => {
        pathCharacters += value.length;
        if (pathCharacters > 8 * 1024 * 1024) throw new KitError('RESOURCE_LIMIT', 'Expanded graph paths exceed 8 Mi characters');
        paths.set(slot, value);
    };
    for (const start of nodeSlots) {
        if (paths.has(start)) continue;
        const chain: number[] = [], seen = new Set<number>(); let current: number | null = start;
        while (current !== null && nodes.has(current) && !paths.has(current)) {
            if (seen.has(current)) { issue('HIERARCHY_CYCLE', start, 'Cycle in serialized parent graph'); setPath(current, '/!cycle-' + randomUUID()); break; }
            seen.add(current); chain.push(current); current = parents.get(current)!;
        }
        while (chain.length) {
            const slot = chain.pop()!; if (paths.has(slot)) continue;
            const parent = parents.get(slot), prefix = parent !== null && parent !== undefined ? paths.get(parent) || '' : '';
            const segment = segments.get(slot)!;
            if (prefix.length + segment.length + 1 > 8 * 1024 * 1024 - pathCharacters) throw new KitError('RESOURCE_LIMIT', 'Expanded graph path budget exceeded');
            setPath(slot, prefix + '/' + segment);
        }
    }
    const allPaths = new Set<string>();
    function add(slot: number, kind: Entity['kind'], type: string, label: string, component?: { type: string; ordinal: number }) {
        if (allPaths.has(label)) { issue('PATH_COLLISION', slot, 'Path collision'); label += '/!' + randomUUID(); }
        allPaths.add(label);
        const ref = { project: context.project, source: context.source, document: context.document, session: context.session, revision, handle: randomUUID(), path: label, ...(component ? { component } : {}) };
        const entity: Entity = { ref, kind, type, properties: {}, coverage: { inventory: true, read: 'serialized', roundtrip: 'preserve', write: false }, orphan: false };
        entities.push(entity); slots.set(slot, entity); return entity;
    }
    for (const slot of nodeSlots) {
        const entity = add(slot, 'node', data[slot].__type__, paths.get(slot)!);
        entity.name = names.get(slot)!; entity.activeSelf = data[slot]._active !== false;
    }
    for (const slot of nodeSlots) {
        const node = slots.get(slot)!, counts = new Map<string, number>(); node.components = [];
        const declared = data[slot]._components;
        if (declared !== undefined && !Array.isArray(declared)) issue('INVALID_COMPONENT', slot, 'Components must be an array');
        for (const ref of Array.isArray(declared) ? declared : []) {
            const target = ref?.__id__;
            if (!Number.isInteger(target) || !data[target] || nodes.has(target) || slots.has(target)) { issue('INVALID_COMPONENT', slot, 'Invalid, shared or duplicated component slot'); continue; }
            if (data[target].node?.__id__ !== slot) issue('COMPONENT_OWNER', slot, 'Component owner does not match node');
            const type = typeFor(data[target].__type__ || 'Object'), ordinal = counts.get(type) || 0; counts.set(type, ordinal + 1);
            const component = add(target, 'component', type, node.ref.path + '#' + escapeSegment(type) + '[' + ordinal + ']', { type, ordinal });
            node.components.push(component.ref);
        }
    }
    const recordCounts = new Map<string, number>();
    for (let i = 0; i < data.length; i++) {
        if (slots.has(i)) continue;
        const type = typeFor(data[i].__type__ || 'Object'), kind = /^cc\.(Prefab|SceneAsset|PrefabInfo|CompPrefabInfo|PrefabInstance|PropertyOverrideInfo|TargetInfo|TargetOverrideInfo)$/.test(type) ? 'storage' : 'record';
        const ordinal = recordCounts.get(type) || 0; recordCounts.set(type, ordinal + 1);
        add(i, kind, type, '/records/' + escapeSegment(type) + '[' + ordinal + ']');
    }
    const active = new Map<number, boolean>();
    for (const start of nodeSlots) {
        if (active.has(start)) continue;
        const chain: number[] = [], seen = new Set<number>(); let current: number | null = start;
        while (current !== null && nodes.has(current) && !active.has(current) && !seen.has(current)) { seen.add(current); chain.push(current); current = parents.get(current)!; }
        let inherited = current !== null && seen.has(current) ? false : current !== null && nodes.has(current) ? active.get(current)! : true;
        while (chain.length) { const slot = chain.pop()!; inherited = inherited && data[slot]._active !== false; active.set(slot, inherited); }
    }
    for (const slot of nodeSlots) {
        const entity = slots.get(slot)!, parent = parents.get(slot)!;
        entity.parent = parent !== null && nodes.has(parent) ? slots.get(parent)!.ref : null;
        entity.children = []; entity.activeInHierarchy = active.get(slot)!;
        const declared = data[slot]._children;
        if (declared !== undefined && !Array.isArray(declared)) { issue('INVALID_CHILDREN', slot, 'Children must be an array'); continue; }
        const seen = new Set<number>();
        for (const child of declared || []) {
            const target = child?.__id__;
            if (!nodes.has(target) || parents.get(target) !== slot || seen.has(target)) { issue('CHILD_PARENT_MISMATCH', slot, 'Child-parent relation is inconsistent'); continue; }
            seen.add(target); entity.children.push(slots.get(target)!.ref);
        }
        for (const child of children.get(slot) || []) if (!seen.has(child)) issue('CHILD_PARENT_MISMATCH', slot, 'Parent child-list omits a child');
    }
    const rootSlots = nodeSlots.filter(slot => parents.get(slot) === null || !nodes.has(parents.get(slot)!));
    return { entities, slots, findings, rootSlots, roots: rootSlots.map(slot => slots.get(slot)!.ref) };
}
