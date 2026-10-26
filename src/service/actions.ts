import {KitError} from '../contracts/errors.js';
export function serviceActionPlan(platform:NodeJS.Platform,domain:string,label:string,file:string,action:'start'|'stop'){
 if(!/^local\.black-dolphin-forge\.[a-f0-9]+$/.test(label))throw new KitError('CONFLICT','Invalid owned service label');
 if(platform==='darwin')return (action==='start'?[['enable',domain+'/'+label],['bootstrap',domain,file]]:[['disable',domain+'/'+label],['bootout',domain,file]]).map(args=>({command:'launchctl',args}));
 if(platform==='win32')return (action==='start'?[['/Change','/TN',label,'/ENABLE'],['/Run','/TN',label]]:[['/Change','/TN',label,'/DISABLE'],['/End','/TN',label]]).map(args=>({command:'schtasks.exe',args}));
 throw new KitError('UNAVAILABLE_CAPABILITY','Service control supports macOS and Windows');
}
