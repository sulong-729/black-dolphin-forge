import * as cc from 'cc';
const {ccclass}=cc._decorator;
@ccclass('PreviewFixture')
export class PreviewFixture extends cc.Component {
 start(){
  const scene=this.node.scene!,canvasNode=new cc.Node('BuildCanvas');canvasNode.layer=cc.Layers.Enum.UI_2D;scene.addChild(canvasNode);canvasNode.addComponent(cc.UITransform).setContentSize(720,1280);const canvas=canvasNode.addComponent(cc.Canvas);
  const cameraNode=new cc.Node('BuildCamera');scene.addChild(cameraNode);cameraNode.setPosition(0,0,1000);const camera=cameraNode.addComponent(cc.Camera);camera.projection=cc.Camera.ProjectionType.ORTHO;camera.orthoHeight=640;camera.visibility=cc.Layers.Enum.UI_2D;camera.clearColor=new cc.Color(13,24,42);canvas.cameraComponent=camera;
  const title=new cc.Node('Title');title.layer=cc.Layers.Enum.UI_2D;canvasNode.addChild(title);const label=title.addComponent(cc.Label);label.string='BLACK DOLPHIN FORGE\nWeb Mobile build qualification';label.fontSize=24;label.color=new cc.Color(90,230,210);
 }
}
