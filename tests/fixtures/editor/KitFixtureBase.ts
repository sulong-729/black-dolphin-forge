import { _decorator, Component, Node } from 'cc';
const {ccclass,property}=_decorator;
@ccclass('KitFixtureBase')
export class KitFixtureBase extends Component {
    @property({type:Node}) target:Node|null=null;
    @property({type:[Node]}) targets:Node[]=[];
    @property({visible:false}) hiddenValue=7;
    @property({serializable:false}) transientValue=3;
    @property({formerlySerializedAs:'legacyCount'}) renamedCount=5;
}
