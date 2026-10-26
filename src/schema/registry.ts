import { createHash } from 'node:crypto';
export function schemaHash(schema: unknown) { return createHash('sha256').update(JSON.stringify(schema)).digest('hex'); }
