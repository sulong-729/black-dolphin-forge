import {mkdir,cp,readFile,writeFile,copyFile,chmod} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyBundle} from '../dist/distribution/install.js';

const bundle=path.resolve(process.argv[2]||'output/black-dolphin-forge-'+JSON.parse(await readFile('package.json','utf8')).version);
const meta=await verifyBundle(bundle),out=path.resolve('output/installers-'+meta.version);
await mkdir(out); // Never overwrite an earlier build.
const run=(command,args)=>{const r=spawnSync(command,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error(command+' failed');};
const windows=path.join(out,'Black-Dolphin-Forge-'+meta.version+'-Windows');
await mkdir(windows);await cp(bundle,path.join(windows,'bundle'),{recursive:true});
for(const name of ['setup.mjs','Install.cmd'])await copyFile('installers/'+name,path.join(windows,name));
await copyFile('installers/README.md',path.join(windows,'README.md'));
// Python's standard ZIP writer makes this packaging step portable; Python is not required to install.
run(process.env.PYTHON||'python3',['-c',"import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2], sys.argv[3])",windows,out,path.basename(windows)]);
if(process.platform==='darwin'){
 const payload=path.join(out,'macos-payload'),app=path.join(payload,'Applications/Black Dolphin Forge.app'),contents=path.join(app,'Contents');
 await mkdir(path.join(contents,'MacOS'),{recursive:true});await mkdir(path.join(contents,'Resources'));
 await cp(bundle,path.join(contents,'Resources/bundle'),{recursive:true});
 await copyFile('installers/setup.mjs',path.join(contents,'Resources/setup.mjs'));
 await copyFile('desktop/assets/forge.icns',path.join(contents,'Resources/forge.icns'));
 await copyFile('installers/Forge',path.join(contents,'MacOS/Forge'));await chmod(path.join(contents,'MacOS/Forge'),0o755);
 await writeFile(path.join(contents,'Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleName</key><string>Black Dolphin Forge</string><key>CFBundleIdentifier</key><string>local.black-dolphin-forge.installer-app</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleExecutable</key><string>Forge</string><key>CFBundleIconFile</key><string>forge.icns</string><key>CFBundleVersion</key><string>${meta.version}</string><key>LSUIElement</key><true/></dict></plist>`);
 const components=path.join(out,'components.plist');
 run('pkgbuild',['--analyze','--root',payload,components]);
 run(process.env.PYTHON||'python3',['-c',"import plistlib,sys; p=sys.argv[1]; d=plistlib.load(open(p,'rb')); [x.update(BundleIsRelocatable=False) for x in d]; plistlib.dump(d,open(p,'wb'))",components]);
 run('pkgbuild',['--component-plist',components,'--root',payload,'--install-location','/','--identifier','local.black-dolphin-forge.installer','--version',meta.version,'--ownership','recommended',path.join(out,'Black-Dolphin-Forge-'+meta.version+'-macOS.pkg')]);
}
console.log(out);
