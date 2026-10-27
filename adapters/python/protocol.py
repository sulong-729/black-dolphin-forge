"""Version 1 JSON Lines worker. Only the daemon supplies this closed task set.
stdout is protocol only; Creator logs go to stderr. No pip/runtime installs.
"""
import json,sys,os,subprocess,pathlib,hashlib

VERSIONS={"3.7.3","3.6.3","2.1.3","2.4.15"}
def project_version(root):
    versions=[]
    for filename in ("package.json","project.json"):
        file=root/filename
        if not file.exists():continue
        data=json.loads(file.read_text());version=data.get("creator",{}).get("version") if filename=="package.json" else data.get("version")
        if filename=="project.json" and (not isinstance(version,str) or not version.startswith("2.")):continue
        if version:versions.append(version)
    if len(set(versions))!=1 or versions[0] not in VERSIONS:raise ValueError("Missing, conflicting or unsupported Creator version")
    return versions[0]


def perform(task,p):
    root=pathlib.Path(p['project'])
    if task=='doctor':
        return {'python':sys.version.split()[0],'creatorExists':pathlib.Path(p['creator']).is_file(),'platform':sys.platform}
    if task=='validate':
        version=project_version(root)
        if p.get('creatorVersion',version)!=version:raise ValueError('Creator project version differs from profile')
        found=[]
        for meta in (root/'assets').rglob('*.fire.meta' if version.startswith('2.') else '*.scene.meta'):
            if json.loads(meta.read_text()).get('uuid')==p['scene']:found.append(meta)
        if len(found)!=1:raise ValueError('Explicit scene UUID must resolve to exactly one scene')
        return {'scene':p['scene'],'scenePath':str(found[0].relative_to(root)),'creatorVersion':version}
    if task=='export':
        version=project_version(root)
        if p.get('creatorVersion',version)!=version:raise ValueError('Creator project version changed')
        output=pathlib.Path(p['output']);output.mkdir(parents=True,exist_ok=True)
        config={'name':'Black Dolphin Forge','platform':'web-mobile','buildPath':str(output),'outputName':'web-mobile','debug':p['debug'],'scenes':[{'url':p['sceneUrl'],'uuid':p['scene']}],'startScene':p['scene'],'packages':{}}
        config_path=output.parent/'build-config.json';config_path.write_text(json.dumps(config))
        if version.startswith('2.'):
            # 2.x has no qualified custom-engine CLI switch; only its bundled engine is accepted.
            creator=pathlib.Path(p['creator']).resolve()
            bundled=creator.parent.parent/'Resources'/'engine' if sys.platform=='darwin' else creator.parent/'resources'/'engine'
            if pathlib.Path(p['engineRoot']).resolve()!=bundled.resolve():raise ValueError('Creator 2.x requires its matching bundled engine; custom engine selection is unavailable')
            config={'title':'Black Dolphin Forge','platform':'web-mobile','buildPath':str(output),'debug':p['debug'],'startScene':p['scene'],'excludeScenes':[]}
            for meta in (root/'assets').rglob('*.fire.meta'):
                uid=json.loads(meta.read_text()).get('uuid')
                if uid!=p['scene']:config['excludeScenes'].append(uid)
            config_path.write_text(json.dumps(config))
            command=[p['creator'],'--path',str(root),'--build','configPath='+str(config_path)]
        else:
            command=[p['creator'],'--nologin','--engine',p['engineRoot'],'--project',str(root),'--build','configPath='+str(config_path)]
        code=subprocess.call(command,stdout=sys.stderr,stderr=sys.stderr)
        if code not in (0,36):raise ValueError('Creator failed: exit '+str(code))
        index=output/'web-mobile'/'index.html'
        if not index.is_file():raise ValueError('Creator exited without Web Mobile index.html')
        return {'exitCode':code,'target':'web-mobile','index':'output/web-mobile/index.html','launch':'NOT_RUN','visual':'NOT_RUN','nativeDevice':'NOT_RUN'}
    raise ValueError('Unsupported worker task')

def main():
    request=json.loads(sys.stdin.readline(65537))
    if request.get('version')!=1 or not isinstance(request.get('id'),str):raise ValueError('Protocol version/id')
    value=perform(request['task'],request['params'])
    print(json.dumps({'version':1,'id':request['id'],'type':'result','data':value}),flush=True)
if __name__=='__main__':
    try:main()
    except Exception as exc:print(type(exc).__name__+': '+str(exc),file=sys.stderr);sys.exit(1)
