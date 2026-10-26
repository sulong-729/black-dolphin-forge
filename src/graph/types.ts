import type {EntityRef,Value} from '../contracts/index.js';
import type {AssetIndex} from '../assets/index.js';
export interface GraphContext {project:string;source:'disk'|'editor'|'runtime';document:string;session:string|null;creatorVersion:string}
export interface FieldSchema {kind:'number'|'boolean'|'string'|'null'|'value'|'array'|'ref'|'asset-ref';type?:string;fields?:Record<string,FieldSchema>;element?:FieldSchema;nullable?:boolean;targetType?:'node'|'component'|'record';expectedType?:string;min?:number;max?:number}
export interface TypeSchema {fields:Record<string,FieldSchema>}
export interface GraphOptions {assets?:AssetIndex;schemas?:Record<string,TypeSchema>}
export interface Finding {code:string;path:string;message:string}
export interface Entity {ref:EntityRef;kind:'node'|'component'|'record'|'storage';type:string;script?:{document:string};name?:string;parent?:EntityRef|null;children?:EntityRef[];components?:EntityRef[];activeSelf?:boolean;activeInHierarchy?:boolean;properties:Record<string,Value>;coverage:{inventory:true;read:'serialized';roundtrip:'preserve';write:false};orphan:boolean}
export interface Graph {formatVersion:1;snapshotId:string;context:GraphContext;revision:string;assetRevision:string;roots:EntityRef[];entities:Entity[];findings:Finding[];coverage:{totalRecords:number;unresolved:number;opaque:number;integrity:boolean;write:false;engineQualified:false}}
export type NativeRecord=Record<string,any>;
