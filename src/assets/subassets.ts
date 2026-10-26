export interface IndexedAsset {uuid:string;document:string;subAsset:string|null;file:string;importer:string|null;className?:string}
export const assetKey=(asset:Pick<IndexedAsset,'document'|'subAsset'>)=>JSON.stringify([asset.document,asset.subAsset]);
const importedTypes:Record<string,string[]>={
 'sprite-frame':['cc.SpriteFrame'],texture:['cc.Texture2D'],image:['cc.ImageAsset'],
 audio:['cc.AudioClip'],'audio-clip':['cc.AudioClip'],font:['cc.Font'],'ttf-font':['cc.TTFFont','cc.Font'],'bitmap-font':['cc.BitmapFont','cc.Font'],
 material:['cc.Material'],prefab:['cc.Prefab'],scene:['cc.SceneAsset'],'animation-clip':['cc.AnimationClip'],'spine-data':['sp.SkeletonData']
};
export function importerCompatible(importer:string|null,expected:string|null){return !expected||expected==='cc.Asset'||!!importer&&!!importedTypes[importer]?.includes(expected);}
