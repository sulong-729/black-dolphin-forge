import {z} from 'zod';
import {EntityRefSchema,PropertySelectorSchema,ValueSchema,type Value} from '../contracts/index.js';
import {KitError} from '../contracts/errors.js';
import {GraphDocument,equal} from './decode.js';
import {requirePatchable} from './integrity.js';
import {encodeValue} from './resolve.js';
import type {FieldSchema} from './types.js';
export const PatchStepSchema=z.object({operation:z.enum(['property.set','reference.bind']),target:EntityRefSchema,selector:PropertySelectorSchema.min(1).max(64),expected:ValueSchema.optional(),value:ValueSchema}).strict();
export type PatchStep=z.infer<typeof PatchStepSchema>;
export function patchRecords(doc:GraphDocument,steps:unknown[]){
 if(!Array.isArray(steps)||steps.length>100)throw new KitError('RESOURCE_LIMIT','At most 100 patch steps');
 const records=doc.nativeRecords(),changes:{target:string;selector:PatchStep['selector']}[]=[];
 if(!steps.length)return {records,changes};requirePatchable(doc.view);const applied:{slot:number;selector:PatchStep['selector']}[]=[];
 for(const input of steps){
  if(!input||typeof input!=='object'||!['property.set','reference.bind'].includes((input as any).operation))throw new KitError('UNSUPPORTED_OPERATION','Only property.set/reference.bind are supported');
  const parsed=PatchStepSchema.safeParse(input);if(!parsed.success)throw new KitError('SCHEMA_MISMATCH','Invalid patch: '+parsed.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));const step=parsed.data;
  const entity=doc.resolve(step.target),schema=doc.schema(entity.type);if(!schema)throw new KitError('UNSUPPORTED_OPERATION','No trusted offline field schema for '+entity.type);
  const slot=doc.nativeSlot(step.target);if(applied.some(p=>p.slot===slot&&p.selector.slice(0,Math.min(p.selector.length,step.selector.length)).every((v,i)=>equal(v,step.selector[i]))))throw new KitError('CONFLICT','Overlapping patch selectors');
  const first=step.selector[0];if(!('field'in first)||!Object.hasOwn(entity.properties,first.field)||!Object.hasOwn(schema.fields,first.field))throw new KitError('SCHEMA_MISMATCH','Unknown/unqualified property selector');
  let typed:Value=entity.properties[first.field],declared:FieldSchema=schema.fields[first.field],container:any=records[slot],key:string|number=first.field;
  for(const segment of step.selector.slice(1)){
   container=container[key];
   if('field'in segment){if(typed.kind!=='value'||declared.kind!=='value'||!declared.fields||!Object.hasOwn(typed.fields,segment.field)||!Object.hasOwn(declared.fields,segment.field))throw new KitError('SCHEMA_MISMATCH','Invalid nested field selector');typed=typed.fields[segment.field];declared=declared.fields[segment.field];key=segment.field;}
   else {if(typed.kind!=='array'||declared.kind!=='array'||!declared.element||segment.index>=typed.items.length)throw new KitError('SCHEMA_MISMATCH','Invalid array index selector');typed=typed.items[segment.index];declared=declared.element;key=segment.index;}
  }
  if(typed.kind==='opaque'||typed.kind==='unresolved')throw new KitError('UNSUPPORTED_OPERATION','Opaque/unresolved baseline requires a qualified value codec');
  if(typed.kind!=='null'&&typed.kind!==declared.kind)throw new KitError('SCHEMA_MISMATCH','Captured field does not match trusted schema');
  if(step.expected&&!equal(step.expected,typed))throw new KitError('STALE_REVISION','Expected-before mismatch at '+entity.ref.path);
  if(step.operation==='reference.bind'&&!['ref','asset-ref','null'].includes(step.value.kind))throw new KitError('SCHEMA_MISMATCH','reference.bind requires a typed reference');
  const value=encodeValue(step.value,declared,container[key],doc,entity.ref.path+'/'+JSON.stringify(step.selector));
  if(!equal(value,container[key])){Object.defineProperty(container,key,{value,writable:true,enumerable:true,configurable:true});changes.push({target:entity.ref.path,selector:step.selector});}
  applied.push({slot,selector:step.selector});
 }
 return {records,changes};
}
