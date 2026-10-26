export const vector=(v:any)=>v?{x:v.x,y:v.y,z:v.z??0}:null;
export const asset=(v:any)=>v?{kind:'asset',uuid:typeof v.uuid==='string'?v.uuid:null,name:typeof v.name==='string'?v.name:null,type:v.constructor?.name??'unknown'}:null;
export function inspectUi(cc:any,node:any,components:any[],ref:(o:any)=>unknown,phase:string){
 const find=(type:any)=>type?components.find(c=>c.constructor===type):undefined;
 const ui=find(cc.UITransform),widget=find(cc.Widget),layout=find(cc.Layout),scroll=find(cc.ScrollView),mask=find(cc.Mask),label=find(cc.Label)||find(cc.RichText),sprite=find(cc.Sprite);
 let geometry:any={availability:'unavailable',reason:'No UITransform on node'};
 if(ui){const width=ui.width,height=ui.height,anchor={x:ui.anchorPoint.x,y:ui.anchorPoint.y},locals=[[-width*anchor.x,-height*anchor.y],[width*(1-anchor.x),-height*anchor.y],[width*(1-anchor.x),height*(1-anchor.y)],[-width*anchor.x,height*(1-anchor.y)]];
  const localCorners=locals.map(([x,y])=>({x,y,z:0})),worldCorners=localCorners.map(p=>vector(ui.convertToWorldSpaceAR(new cc.Vec3(p.x,p.y,p.z),new cc.Vec3())));
  geometry={availability:'available',width,height,anchor,localCorners,worldCorners,coordinateSpace:'world-units',scope:'own-quad-excludes-descendant-union'};
  let ancestor=node;while(ancestor){const canvas=cc.Canvas&&ancestor.getComponent(cc.Canvas),camera=canvas?.cameraComponent;if(camera){geometry.screenCorners=worldCorners.map((p:any)=>vector(camera.worldToScreen(new cc.Vec3(p.x,p.y,p.z),new cc.Vec3())));geometry.screenCoordinateSpace='render-pixels-bottom-left';geometry.camera=ref(camera);break;}ancestor=ancestor.parent;}
 }
 return {geometry,widget:widget?{enabled:widget.enabled,enabledInHierarchy:widget.enabledInHierarchy,target:ref(widget.target),top:widget.top,bottom:widget.bottom,left:widget.left,right:widget.right,isAlignTop:widget.isAlignTop,isAlignBottom:widget.isAlignBottom,isAlignLeft:widget.isAlignLeft,isAlignRight:widget.isAlignRight,alignMode:widget.alignMode}:null,
 layout:{phase,updateInvoked:false,configuration:layout?{enabled:layout.enabled,type:layout.type,resizeMode:layout.resizeMode,spacingX:layout.spacingX,spacingY:layout.spacingY}:null,completion:'not-proven-by-observation'},
 scrollView:scroll?{content:ref(scroll.content),contentParent:ref(scroll.content?.parent),horizontalScrollBar:ref(scroll.horizontalScrollBar),verticalScrollBar:ref(scroll.verticalScrollBar),horizontal:scroll.horizontal,vertical:scroll.vertical,contentPosition:vector(scroll.content?.position)}:null,
 mask:mask?{type:mask.type,enabled:mask.enabled,enabledInHierarchy:mask.enabledInHierarchy}:null,label:label?{string:typeof label.string==='string'?label.string.slice(0,2000):null,truncated:typeof label.string==='string'&&label.string.length>2000,font:asset(label.font),fontSize:label.fontSize}:null,sprite:sprite?{spriteFrame:asset(sprite.spriteFrame),texture:asset(sprite.spriteFrame?.texture)}:null};
}
