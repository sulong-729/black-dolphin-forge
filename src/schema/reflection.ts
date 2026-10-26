import { createRequire } from 'node:module';
// One implementation runs both in the scene owner and contract harness.
const reflection = createRequire(import.meta.url)('../../extensions/cocos-ai-bridge/reflection.js');
export const inventory: (cc: unknown) => any = reflection.inventory;
export const describeType: (cc: unknown, ctor: unknown) => any = reflection.describeType;
export const readProperties: (cc: unknown, object: unknown, schema: unknown, refs?: Map<object, string>) => any = reflection.readProperties;
