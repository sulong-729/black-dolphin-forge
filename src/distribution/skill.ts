import {readFile} from 'node:fs/promises';
import {crc32} from 'node:zlib';
import {fileURLToPath} from 'node:url';

// Fixed, public files only. Store-mode ZIP needs no extra runtime dependency.
export async function skillArchive(): Promise<Buffer> {
    const files = ['SKILL.md', 'references/capabilities.json',
        ...['operations', 'compatibility', 'runtime', 'build'].map(n => `references/docs/${n}.md`)];
    const chunks: Buffer[] = [], directory: Buffer[] = [];
    let offset = 0;
    for (const file of files) {
        const data = await readFile(fileURLToPath(new URL('../../skills/cocos-ai-toolkit/' + file, import.meta.url)));
        const name = Buffer.from('cocos-ai-toolkit/' + file), crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(33, 12);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
        chunks.push(local, name, data); directory.push(central, name);
        offset += local.length + name.length + data.length;
    }
    const index = Buffer.concat(directory), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10); end.writeUInt32LE(index.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...chunks, index, end]);
}
