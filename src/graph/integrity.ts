import {KitError} from '../contracts/errors.js';
import type {Graph} from './types.js';
export function requirePatchable(graph:Graph){
 if(!graph.coverage.integrity)throw new KitError('INTEGRITY_ERROR','Malformed graph hierarchy cannot be patched');
 if(graph.coverage.unresolved)throw new KitError('UNSUPPORTED_OPERATION','Unresolved references/provenance block offline edits');
 if(graph.findings.some(f=>f.code==='UNSUPPORTED_PREFAB'||f.code==='DUPLICATE_UUID'))throw new KitError('UNSUPPORTED_OPERATION','Prefab override or ambiguous asset mutation requires a qualified Editor adapter');
}
