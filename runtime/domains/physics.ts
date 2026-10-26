import {vector} from './ui.js';
export function inspectPhysics(cc:any,components:any[]){
 const body3=cc.RigidBody&&components.find(c=>c.constructor===cc.RigidBody),body2=cc.RigidBody2D&&components.find(c=>c.constructor===cc.RigidBody2D),collider3=cc.Collider&&components.filter(c=>Object.getPrototypeOf(c.constructor)===cc.Collider),collider2=cc.Collider2D&&components.filter(c=>Object.getPrototypeOf(c.constructor)===cc.Collider2D);
 const info=(component:any,dimension:'3D'|'2D')=>{
  if(!component)return null;
  const configuration={type:component.type,mass:component.mass,enabled:component.enabled};
  // Versioned 3.7.3 alias: RigidBody2D stores its wrapper in own data _body; the 3D type exposes body.
  const descriptor=Object.getOwnPropertyDescriptor(component,'_body'),backend=dimension==='3D'?component.body:descriptor&&'value'in descriptor?descriptor.value:null;
  const unavailable=(reason:string)=>({availability:'unavailable',dimension,configuration,reason});
  try{
   if(!backend||!backend.impl||typeof backend.getLinearVelocity!=='function')return unavailable('Physics backend/body is not initialized or uses a no-op fallback');
   const out=dimension==='3D'?new cc.Vec3(NaN,NaN,NaN):cc.Vec2?new cc.Vec2(NaN,NaN):{x:NaN,y:NaN};backend.getLinearVelocity(out);
   const values=dimension==='3D'?[out.x,out.y,out.z]:[out.x,out.y];if(!values.every(Number.isFinite))return unavailable('Backend did not fill a finite velocity observation');
   return {availability:'available',dimension,...configuration,velocity:vector(out),units:'Cocos engine API units; no inferred screen/metre conversion',backend:'qualified-wrapper-read; not native profiler telemetry'};
  }catch{return unavailable('Physics backend observation failed');}
 };
 return {availability:body3||body2?'available':'unavailable',body3D:info(body3,'3D'),body2D:info(body2,'2D'),colliders:{threeD:cc.Collider?{availability:'available',count:collider3?.length??0}:{availability:'unavailable',reason:'Collider package not present'},twoD:cc.Collider2D?{availability:'available',count:collider2?.length??0}:{availability:'unavailable',reason:'Collider2D package not present'},scope:'recognized immediate Collider subclasses only'},simulationChanged:false};
}
