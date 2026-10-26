import {writeFile,mkdir} from 'node:fs/promises';
import {z} from 'zod';
import {EnvelopeSchema,ResultSchema,EntityRefSchema,AssetRefSchema,PropertySelectorSchema,ValueSchema} from '../dist/contracts/index.js';
const dir=new URL('../src/contracts/schema/',import.meta.url);await mkdir(dir,{recursive:true});
for(const [name,schema] of Object.entries({request:EnvelopeSchema,result:ResultSchema,entity:EntityRefSchema,asset:AssetRefSchema,selector:PropertySelectorSchema,value:ValueSchema}))await writeFile(new URL(name+'.json',dir),JSON.stringify(z.toJSONSchema(schema),null,2)+'\n');
