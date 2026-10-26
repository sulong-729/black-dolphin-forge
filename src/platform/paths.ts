import path from 'node:path';
import os from 'node:os';
export function platformPaths(platform: NodeJS.Platform = process.platform, env: {
    home?: string;
    appData?: string;
    localAppData?: string;
    state?: string;
} = {}) {
    const home = env.home || os.homedir();
    const p = platform === 'win32' ? path.win32 : path.posix;
    const state = env.state || process.env.COCOS_AI_STATE_DIR || (platform === 'win32' ? p.join(env.appData || process.env.APPDATA || p.join(home, 'AppData', 'Roaming'), 'Cocos AI Toolkit') : platform === 'darwin' ? p.join(home, 'Library', 'Application Support', 'Cocos AI Toolkit') : p.join(home, '.local', 'state', 'cocos-ai-toolkit'));
    const cache = platform === 'win32' ? p.join(env.localAppData || process.env.LOCALAPPDATA || p.join(home, 'AppData', 'Local'), 'Cocos AI Toolkit', 'Cache') : platform === 'darwin' ? p.join(home, 'Library', 'Caches', 'Cocos AI Toolkit') : p.join(home, '.cache', 'cocos-ai-toolkit');
    return { state, cache };
}
