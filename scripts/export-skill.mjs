import {writeFile,mkdir} from 'node:fs/promises';
import {skillArchive} from '../dist/distribution/skill.js';
await mkdir('output',{recursive:true});await writeFile('output/cocos-ai-toolkit-skill.zip',await skillArchive());console.log('output/cocos-ai-toolkit-skill.zip');
