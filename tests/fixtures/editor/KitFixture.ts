import { _decorator, Enum } from 'cc';
import { KitFixtureBase } from './KitFixtureBase';
const {ccclass,property}=_decorator;
@ccclass('KitFixture')
export class KitFixture extends KitFixtureBase {
    @property({type:Enum({One:1,Two:2})}) mode=1;
}
