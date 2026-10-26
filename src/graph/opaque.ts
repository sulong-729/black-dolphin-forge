import {KitError} from '../contracts/errors.js';
import {randomUUID} from 'node:crypto';
import type {Value} from '../contracts/index.js';
export class Payloads {
 private values=new Map<string,unknown>();
 get bytes(){return Buffer.byteLength(JSON.stringify([...this.values]));}
 read(handle:string){if(!this.values.has(handle))throw new KitError('STALE_HANDLE','Opaque payload handle is not owned by this graph');return structuredClone(this.values.get(handle));}
 opaque(value:unknown,typeHint:string):Value{const payloadHandle=randomUUID();this.values.set(payloadHandle,structuredClone(value));return {kind:'opaque',payloadHandle,typeHint,reason:'No qualified inline value codec'};}
 unresolved(value:unknown,expectedType:string,reason:string):Value{const rawHandle=randomUUID();this.values.set(rawHandle,structuredClone(value));return {kind:'unresolved',rawHandle,expectedType,reason};}
}
