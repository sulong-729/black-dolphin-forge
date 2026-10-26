import { z } from 'zod';
export const stepSchema = z.object({
    operation: z.enum(['property.set', 'reference.bind', 'node.rename']),
    target: z.string().startsWith('/').max(4096), field: z.string().min(1).max(128),
    expected: z.unknown(), value: z.unknown(),
}).strict().refine(s => Object.hasOwn(s, 'expected') && Object.hasOwn(s, 'value'), 'Expected-before and value are mandatory');
export const proposalSchema = z.object({ steps: z.array(stepSchema).min(1).max(20), scope: z.literal('scene-instance'), save: z.literal(false) }).strict();
export const applySchema = z.object({ proposal: z.string().uuid(), idempotencyKey: z.string().min(1).max(128) }).strict();
export type MutationStep = z.infer<typeof stepSchema>;
export const mutationControls = new Set(['editor.apply']);
