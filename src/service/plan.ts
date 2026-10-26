import path from 'node:path';
import { createHash } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
const xml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
export interface ServiceOptions {
    platform: NodeJS.Platform;
    home: string;
    node: string;
    cli: string;
    state: string;
    username: string;
    uid?: number;
}
export function servicePlan(p: ServiceOptions) {
    const label = 'local.black-dolphin-forge.' + createHash('sha256').update(p.state).digest('hex').slice(0, 12), scope = 'current-user';
    if ([p.node, p.cli, p.state, p.home, p.username].some(v => /[\x00-\x1f]/.test(v)))
        throw new KitError('SCHEMA_MISMATCH', 'Control characters in service settings');
    if (p.platform === 'darwin') {
        const domain = 'gui/' + (p.uid ?? 'current'), file = path.posix.join(p.home, 'Library/LaunchAgents', label + '.plist'), args = [p.node, p.cli, 'service', 'host', p.state];
        return { label, scope, file, contents: `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(a => '<string>' + xml(a) + '</string>').join('')}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>${xml(path.posix.join(p.state, 'service.stdout.log'))}</string><key>StandardErrorPath</key><string>${xml(path.posix.join(p.state, 'service.stderr.log'))}</string></dict></plist>`, install: { command: 'launchctl', args: ['bootstrap', domain, file], shell: false }, uninstall: { command: 'launchctl', args: ['bootout', domain, file], shell: false }, status: { command: 'launchctl', args: ['print', domain + '/' + label], shell: false } };
    }
    if (p.platform === 'win32') {
        if (!p.username)
            throw new KitError('SCHEMA_MISMATCH', 'Current Windows user required');
        const quote = (s: string) => '"' + s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"', args = [p.cli, 'service', 'host', p.state].map(quote).join(' '), file = path.win32.join(p.state, label + '.xml');
        return { label, scope, file, contents: `<?xml version="1.0" encoding="UTF-16"?><Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xml(p.username)}</UserId></LogonTrigger></Triggers><Principals><Principal id="Author"><UserId>${xml(p.username)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT0S</ExecutionTimeLimit></Settings><Actions Context="Author"><Exec><Command>${xml(p.node)}</Command><Arguments>${xml(args)}</Arguments></Exec></Actions></Task>`, install: { command: 'schtasks.exe', args: ['/Create', '/TN', label, '/XML', file], shell: false }, uninstall: { command: 'schtasks.exe', args: ['/Delete', '/TN', label, '/F'], shell: false }, status: { command: 'schtasks.exe', args: ['/Query', '/TN', label], shell: false } };
    }
    throw new KitError('UNAVAILABLE_CAPABILITY', 'User service qualified only for macOS/Windows plan generation');
}
