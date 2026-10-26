import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { DataSourceSchema } from './entities.js';
import { KitError, errorCodes } from './errors.js';
export const EnvelopeSchema = z.object({
    formatVersion: z.literal(1), requestId: z.string().min(1).max(128),
    operation: z.string().regex(/^[a-z][a-z0-9.-]{0,99}$/),
    projectId: z.string().min(1).max(128).optional(), source: DataSourceSchema.default('disk'),
    session: z.string().nullable().optional(), revision: z.string().optional(), creatorVersion: z.string().optional(),
    params: z.record(z.string(), z.unknown()).default({}),
}).strict();
export type RequestEnvelope = z.infer<typeof EnvelopeSchema>;
export const ResultSchema = z.object({
    formatVersion: z.literal(1), requestId: z.string(),
    status: z.enum(['ok', 'unchanged', 'partial', 'error', 'indeterminate']),
    data: z.unknown().optional(), warnings: z.array(z.string()),
    revision: z.string().optional(), source: DataSourceSchema.optional(),
    error: z.object({ code: z.enum(errorCodes), message: z.string(), recovery: z.string() }).strict().optional(),
}).strict();
export type ResultEnvelope = z.infer<typeof ResultSchema>;
export function validateEnvelope(value: unknown): RequestEnvelope {
    const parsed = EnvelopeSchema.safeParse(value);
    if (!parsed.success)
        throw new KitError('SCHEMA_MISMATCH', 'Invalid request schema: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
    return parsed.data;
}
export function createRequest(operation: string, params: Record<string, unknown> = {}, extra: Partial<RequestEnvelope> = {}): RequestEnvelope {
    return validateEnvelope({ formatVersion: 1, requestId: randomUUID(), operation, source: 'disk', params, ...extra });
}
