import { GraphDocument } from '../graph/decode.js';
import { SourceIndex } from './typescript-index.js';
import { KitError } from '../contracts/errors.js';
export function eventBindings(index: SourceIndex, graph: GraphDocument) {
    const records = graph.nativeRecords(), entities = graph.view.entities;
    const bySlot = new Map(entities.map(e => [graph.nativeSlot(e.ref), e]));
    const result: any[] = [];
    let count = 0;
    for (const owner of entities.filter(e => e.kind === 'component')) {
        const walk = (value: any, selector: (string | number)[], depth: number) => {
            if (depth > 32 || ++count > 100000)
                throw new KitError('RESOURCE_LIMIT', 'Serialized binding traversal budget');
            if (!value || typeof value !== 'object')
                return;
            if (Array.isArray(value)) {
                value.forEach((v, i) => walk(v, [...selector, i], depth + 1));
                return;
            }
            if (Object.keys(value).length === 1 && Number.isInteger(value.__id__)) {
                const event = records[value.__id__];
                if (event?.__type__ === 'cc.ClickEvent')
                    walk(event, [...selector, '@record'], depth + 1);
                return;
            }
            if (value.__type__ === 'cc.ClickEvent') {
                const target = Number.isInteger(value.target?.__id__) ? bySlot.get(value.target.__id__) : undefined;
                let type = typeof value._componentId === 'string' && value._componentId ? '' : typeof value.component === 'string' ? value.component : '';
                if (typeof value._componentId === 'string' && value._componentId) {
                    try {
                        type = graph.assets()?.resolveUuid(value._componentId).className || '';
                    }
                    catch { }
                    if (!type && index.classes.some(c => c.registered.includes(value._componentId)))
                        type = value._componentId;
                }
                const receivers = target?.kind === 'node' ? target.components?.map(ref => graph.resolve(ref)).filter(c => c.type === type) ?? [] : [];
                const binding: any = { serialized: { document: graph.view.context.document, owner: owner.ref.path, selector }, handler: typeof value.handler === 'string' ? value.handler : null, component: type || null, receiver: receivers.length === 1 ? receivers[0].ref : null, status: 'unknown', confidence: 'serialized-static', customEventData: typeof value.customEventData === 'string' ? value.customEventData : null };
                if (receivers.length === 1 && binding.handler) {
                    try {
                        const resolved = index.resolve(type), method = index.method(resolved.id, binding.handler);
                        binding.location = method.location;
                        binding.status = method.body ? 'resolved' : method.status === 'non-callable' ? 'unknown' : 'declaration-only';
                        if (method.status === 'non-callable')
                            binding.reason = 'HANDLER_NOT_CALLABLE';
                        binding.sourceKind = method.status;
                    }
                    catch (e) {
                        binding.reason = (e as KitError).code || 'UNRESOLVED';
                    }
                }
                else
                    binding.reason = receivers.length > 1 ? 'AMBIGUOUS_RECEIVER' : 'TARGET_COMPONENT_UNRESOLVED';
                result.push(binding);
                return;
            }
            for (const [key, child] of Object.entries(value))
                if (!['node', '_prefab', '__prefab'].includes(key))
                    walk(child, [...selector, key], depth + 1);
        };
        walk(records[graph.nativeSlot(owner.ref)], [], 0);
    }
    return result;
}
