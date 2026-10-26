import {KitError} from '../contracts/errors.js';
import type {FieldSchema} from './types.js';
import type {GraphDocument} from './decode.js';
import type {Value} from '../contracts/index.js';
export function encodeValue(value:Value,schema:FieldSchema,original:any,doc:GraphDocument,where:string):any{
 const mismatch=()=>new KitError('SCHEMA_MISMATCH','Value/schema mismatch at '+where);
 if(value.kind==='null'){if(schema.kind==='null'||schema.nullable)return null;throw mismatch();}
 if(value.kind!==schema.kind)throw mismatch();
 switch(value.kind){
  case 'number':if(!Number.isFinite(value.value)||schema.min!==undefined&&value.value<schema.min||schema.max!==undefined&&value.value>schema.max)throw mismatch();return value.value;
  case 'boolean':case 'string':return value.value;
  case 'ref':{if(value.targetType!==schema.targetType)throw mismatch();const target=doc.resolve(value.target);if(schema.type&&target.type!==schema.type)throw mismatch();if(target.kind!==value.targetType)throw mismatch();return {...(original&&typeof original==='object'?original:{}),__id__:doc.nativeSlot(value.target)};}
  case 'asset-ref':{if(value.target.project!==doc.view.context.project)throw new KitError('FOREIGN_PROJECT','Asset reference belongs to another project');const priorType=typeof original?.__expectedType__==='string'?original.__expectedType__:null;const expectedType=schema.expectedType??priorType;if(priorType&&schema.expectedType&&priorType!==schema.expectedType||expectedType!==value.target.expectedType)throw mismatch();const asset=doc.assets()?.resolvePath(value.target);if(!asset)throw mismatch();return {...(original&&typeof original==='object'?original:{}),__uuid__:asset.uuid,...value.target.expectedType?{__expectedType__:value.target.expectedType}:{}};}
  case 'array':throw new KitError('UNSUPPORTED_OPERATION','Whole array replacement/reordering is unsupported; select an existing element');
  case 'value':{
   if(value.type!==schema.type||!schema.fields||!original||typeof original!=='object')throw mismatch();const expected=Object.keys(original).filter(k=>k!=='__type__').sort();if(JSON.stringify(Object.keys(value.fields).sort())!==JSON.stringify(expected))throw mismatch();
   const result=structuredClone(original);for(const [field,v]of Object.entries(value.fields)){if(!Object.hasOwn(schema.fields,field))throw new KitError('UNSUPPORTED_OPERATION','Unqualified nested field at '+where+'/'+field);Object.defineProperty(result,field,{value:encodeValue(v,schema.fields[field],original[field],doc,where+'/'+field),writable:true,enumerable:true,configurable:true});}return result;
  }
  default:throw new KitError('UNSUPPORTED_OPERATION','Opaque/unresolved/enum values require qualified codecs');
 }
}
