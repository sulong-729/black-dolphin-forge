'use strict';
// Creator 2.x scene-script IPC contract. Share owner readers, never expose mutations.
const owner=require('./scene').methods;
module.exports={invoke:function(event,input){
    try{
        if(!input||!['legacyContext','sources','observe','read'].includes(input.method)||!Array.isArray(input.args))throw Error('UNSUPPORTED_OPERATION: legacy read method required');
        const value=owner[input.method].apply(null,input.args);
        if(event.reply)event.reply(null,value);
    }catch(error){if(event.reply)event.reply({message:String(error.message||error)});}
}};
