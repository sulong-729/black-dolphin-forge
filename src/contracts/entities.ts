import { z } from 'zod';
export const DataSourceSchema = z.enum(['disk', 'editor', 'runtime']);
export const EntityRefSchema = z.object({
    project: z.string().min(1), source: DataSourceSchema, document: z.string().min(1),
    session: z.string().min(1).nullable(), revision: z.string().min(1),
    handle: z.string().min(1), path: z.string().startsWith('/'),
    component: z.object({ type: z.string().min(1), ordinal: z.number().int().nonnegative() }).strict().optional(),
}).strict();
export const AssetRefSchema = z.object({
    project: z.string().min(1), document: z.string().min(1),
    subAsset: z.string().nullable(), expectedType: z.string().nullable(),
}).strict();
export const PropertySelectorSchema = z.array(z.union([
    z.object({ field: z.string().min(1) }).strict(), z.object({ index: z.number().int().nonnegative() }).strict(),
]));
export type EntityRef = z.infer<typeof EntityRefSchema>;
