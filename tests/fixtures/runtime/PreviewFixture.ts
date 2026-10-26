import * as cc from 'cc';
import {PREVIEW,BUILD} from 'cc/env';
const {ccclass}=cc._decorator;
@ccclass('PreviewFixture')
export class PreviewFixture extends cc.Component {
 private lastWidth=0;private lastHeight=0;
 private canvasNode:cc.Node|null=null;private camera:cc.Camera|null=null;
 private footerNode:cc.Node|null=null;
 private stopBridge:(()=>Promise<void>)|null=null;
 async start(){
  if(!PREVIEW||BUILD)return;
  // Qualification-only canvas: remove Creator's fixed desktop preview wrapper from the measurement.
  const style=document.createElement('style');style.textContent='#GameDiv {width:100vw !important;height:100vh !important;border:0 !important}';document.head.appendChild(style);
  const gameDiv=document.getElementById('GameDiv');if(gameDiv){document.body.appendChild(gameDiv);gameDiv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;display:block;border:0;margin:0;z-index:999;';}
  cc.view.setFrameSize(window.innerWidth,window.innerHeight);
  cc.view.setDesignResolutionSize(720,1280,cc.ResolutionPolicy.FIXED_WIDTH);cc.view.resizeWithBrowserSize(true);
  const scene=this.node.scene!,canvasNode=new cc.Node('Canvas');canvasNode.layer=cc.Layers.Enum.UI_2D;scene.addChild(canvasNode);canvasNode.addComponent(cc.UITransform).setContentSize(720,1280);const canvas=canvasNode.addComponent(cc.Canvas);this.canvasNode=canvasNode;
  const cameraNode=new cc.Node('Camera');scene.addChild(cameraNode);cameraNode.setPosition(0,0,1000);const camera=cameraNode.addComponent(cc.Camera);camera.projection=cc.Camera.ProjectionType.ORTHO;camera.orthoHeight=640;camera.near=0.1;camera.far=2000;camera.visibility=cc.Layers.Enum.UI_2D;camera.clearColor=new cc.Color(13,24,42,255);canvas.cameraComponent=camera;this.camera=camera;
  const panel=(name:string,parent:cc.Node,width:number,height:number,color:cc.Color)=>{const node=new cc.Node(name);node.layer=cc.Layers.Enum.UI_2D;parent.addChild(node);const ui=node.addComponent(cc.UITransform);ui.setContentSize(width,height);const g=node.addComponent(cc.Graphics);const draw=()=>{g.clear();g.fillColor=color;g.rect(-ui.anchorX*ui.width,-ui.anchorY*ui.height,ui.width,ui.height);g.fill();};draw();node.on(cc.Node.EventType.SIZE_CHANGED,draw);return node;};
  const label=(parent:cc.Node,text:string)=>{const node=new cc.Node('Title');node.layer=cc.Layers.Enum.UI_2D;parent.addChild(node);const component=node.addComponent(cc.Label);component.string=text;component.fontSize=24;component.color=cc.Color.WHITE;node.setPosition(0,100);};
  const long=panel('LongPopup',canvasNode,300,1080,new cc.Color(37,75,116));long.setPosition(-170,0);const widget=long.addComponent(cc.Widget);widget.target=canvasNode;widget.isAlignTop=true;widget.isAlignBottom=true;widget.top=100;widget.bottom=100;widget.alignMode=cc.Widget.AlignMode.ON_WINDOW_RESIZE;label(long,'LONG POPUP');
  const short=panel('ShortControls',canvasNode,300,200,new cc.Color(31,122,107));short.setPosition(170,-250);label(short,'SHORT POPUP');short.addComponent(cc.Button).target=short;
  const footer=panel('ShortFooter',canvasNode,300,200,new cc.Color(24,75,75));footer.getComponent(cc.UITransform)!.setAnchorPoint(0.5,1);footer.setPosition(170,-350);this.footerNode=footer;
  const resize=()=>{const h=cc.view.getVisibleSize().height;footer.getComponent(cc.UITransform)!.setContentSize(300,Math.max(1,h/2-350+40));};resize();cc.view.on('design-resolution-changed',resize);this.node.once(cc.Node.EventType.NODE_DESTROYED,()=>cc.view.off('design-resolution-changed',resize));
  const viewNode=panel('View',long,260,500,new cc.Color(20,44,70));viewNode.setPosition(0,-100);viewNode.addComponent(cc.Mask);const content=new cc.Node('Content');content.layer=cc.Layers.Enum.UI_2D;viewNode.addChild(content);content.addComponent(cc.UITransform).setContentSize(240,800);content.setPosition(0,-20);const scroll=long.addComponent(cc.ScrollView);scroll.content=content;
  const inactive=new cc.Node('InactiveParent');canvasNode.addChild(inactive);const activeChild=new cc.Node('ActiveChild');inactive.addChild(activeChild);activeChild.addComponent(cc.UITransform).setContentSize(20,20);inactive.active=false;
  const animationNode=new cc.Node('AnimationProbe');canvasNode.addChild(animationNode);const animation=animationNode.addComponent(cc.Animation),clip=new cc.AnimationClip();clip.name='Pulse';clip.duration=60;animation.createState(clip,'Pulse');animation.play('Pulse');
  const audio=canvasNode.addComponent(cc.AudioSource);audio.playOnAwake=false;audio.volume=0.25;
  const config=await new Promise<any>((resolve,reject)=>cc.resources.load('kit-preview-config',cc.JsonAsset,(error,value)=>error?reject(error):resolve(value.json)));
  const System=(globalThis as any).System;if(!System?.import)throw Error('SystemJS preview loader unavailable');
  const bridge=await System.import(config.url+'/v1/runtime/modules/bridge.js');const connection=await bridge.attachPreview({cc,url:config.url,token:config.token,preview:PREVIEW,build:BUILD});this.stopBridge=connection.stop;
  console.info('[P6 fixture] runtime bridge attached');
 }
 update(){
  if(!PREVIEW||BUILD)return;
  const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight,current={width:this.lastWidth,height:this.lastHeight};
  if(current.width!==width||current.height!==height){this.lastWidth=width;this.lastHeight=height;cc.view.setFrameSize(width,height);cc.view.setDesignResolutionSize(720,1280,cc.ResolutionPolicy.FIXED_WIDTH);const visible=cc.view.getVisibleSize();this.canvasNode?.getComponent(cc.UITransform)?.setContentSize(visible);if(this.camera)this.camera.orthoHeight=visible.height/2;this.footerNode?.getComponent(cc.UITransform)?.setContentSize(300,Math.max(1,cc.view.getVisibleSize().height/2-350+40));}
 }
 onDestroy(){if(this.stopBridge)void this.stopBridge();}
}
