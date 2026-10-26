export class RuntimeIdentity {
 private ids=new WeakMap<object,string>();private count=0;private epoch='';
 constructor(private readonly nonce:string=Math.random().toString(36).slice(2)){}
 reset(epoch:string){if(epoch!==this.epoch){this.epoch=epoch;this.ids=new WeakMap();this.count=0;}}
 handle(object:object){let id=this.ids.get(object);if(!id){id='runtime:'+this.nonce+':'+this.epoch+':'+(++this.count);this.ids.set(object,id);}return id;}
}
