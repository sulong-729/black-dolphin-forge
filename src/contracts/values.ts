import { z } from 'zod';
import { EntityRefSchema, AssetRefSchema } from './entities.js';
export type Value = {
    kind: 'null';
} | {
    kind: 'boolean';
    value: boolean;
} | {
    kind: 'string';
    value: string;
} | {
    kind: 'number';
    value: number;
} | {
    kind: 'enum' | 'bitmask';
    type: string;
    value: number;
    label?: string;
} | {
    kind: 'value';
    type: string;
    fields: Record<string, Value>;
} | {
    kind: 'array';
    elementType: string;
    items: Value[];
} | {
    kind: 'ref';
    targetType: 'node' | 'component' | 'record';
    target: z.infer<typeof EntityRefSchema>;
} | {
    kind: 'asset-ref';
    target: z.infer<typeof AssetRefSchema>;
} | {
    kind: 'opaque';
    payloadHandle: string;
    typeHint: string;
    reason: string;
} | {
    kind: 'unresolved';
    rawHandle: string;
    expectedType: string;
    reason: string;
};
export const ValueSchema: z.ZodType<Value> = z.lazy(() => z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('null') }).strict(),
    z.object({ kind: z.literal('boolean'), value: z.boolean() }).strict(),
    z.object({ kind: z.literal('string'), value: z.string() }).strict(),
    z.object({ kind: z.literal('number'), value: z.number().finite() }).strict(),
    z.object({ kind: z.literal('enum'), type: z.string(), value: z.number().int(), label: z.string().optional() }).strict(),
    z.object({ kind: z.literal('bitmask'), type: z.string(), value: z.number().int(), label: z.string().optional() }).strict(),
    z.object({ kind: z.literal('value'), type: z.string(), fields: z.record(z.string(), ValueSchema) }).strict(),
    z.object({ kind: z.literal('array'), elementType: z.string(), items: z.array(ValueSchema) }).strict(),
    z.object({ kind: z.literal('ref'), targetType: z.enum(['node', 'component', 'record']), target: EntityRefSchema }).strict(),
    z.object({ kind: z.literal('asset-ref'), target: AssetRefSchema }).strict(),
    z.object({ kind: z.literal('opaque'), payloadHandle: z.string(), typeHint: z.string(), reason: z.string() }).strict(),
    z.object({ kind: z.literal('unresolved'), rawHandle: z.string(), expectedType: z.string(), reason: z.string() }).strict(),
]));
