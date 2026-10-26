import {createHash} from 'node:crypto';
import {startController} from './controller.js';
const [state,launcher]=process.argv.slice(2);if(!state||!launcher)throw Error('Desktop state/launcher required');const host=await startController({state,launcher,port:30000+parseInt(createHash('sha256').update(state).digest('hex').slice(0,4),16)%10000});process.once('SIGTERM',()=>void host.close());process.once('SIGINT',()=>void host.close());
