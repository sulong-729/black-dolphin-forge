export interface UiFinding {code:string;path:string;severity:'info'|'warning';[key:string]:unknown;}
export function diagnoseUi(nodes:any[],viewport:any):UiFinding[]{
 const findings:UiFinding[]=[];for(const node of nodes){if(node.activeSelf&&!node.activeInHierarchy)findings.push({code:'INACTIVE_ANCESTOR',path:node.path,severity:'info',message:'Node is locally active under an inactive hierarchy; observation did not activate it.'});
 const geometry=node.ui?.geometry,corners=geometry?.screenCorners,size=viewport?.renderCanvas;
 if(geometry?.availability==='available'&&(geometry.width===0||geometry.height===0))findings.push({code:'ZERO_UI_SIZE',path:node.path,severity:'warning',message:'Observed UITransform has a zero dimension.'});
 if(Array.isArray(corners)&&corners.length&&size?.width>0&&size?.height>0){const xs=corners.map((p:any)=>p.x),ys=corners.map((p:any)=>p.y);if([...xs,...ys].every(Number.isFinite)){const edges={left:Math.min(...xs)<0,right:Math.max(...xs)>size.width,bottom:Math.min(...ys)<0,top:Math.max(...ys)>size.height};if(Object.values(edges).some(Boolean))findings.push({code:'OUTSIDE_RENDER_VIEWPORT',path:node.path,severity:'info',...edges,intent:'unknown-may-be-intentional',coordinateSpace:'render-pixels-bottom-left',message:'Own UI quad extends outside the render viewport; clipping/hidden edges may be intentional.'});}}
 if(node.ui?.widget?.target?.availability==='unresolved')findings.push({code:'UNRESOLVED_WIDGET_TARGET',path:node.path,severity:'warning',message:'Widget target lies outside the captured scene.'});
 }return findings;
}
