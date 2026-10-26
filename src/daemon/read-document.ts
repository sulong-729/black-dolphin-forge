import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { KitError } from '../contracts/errors.js';
/** Read only a bounded regular file. Nonblocking open prevents a FIFO swap from waiting for a writer. */
export async function readDocument(file: string, maxBytes = 32 * 1024 * 1024): Promise<Buffer> {
    const flags = constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK | constants.O_NOFOLLOW);
    const handle = await open(file, flags);
    try {
        const info = await handle.stat();
        if (!info.isFile()) throw new KitError('SCHEMA_MISMATCH', 'Document must be a regular file');
        if (info.size > maxBytes) throw new KitError('RESOURCE_LIMIT', 'Document exceeds byte budget');
        const chunks: Buffer[] = [];
        let size = 0;
        while (size <= maxBytes) {
            const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, maxBytes + 1 - size));
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
            if (!bytesRead) return Buffer.concat(chunks, size);
            size += bytesRead;
            if (size > maxBytes) throw new KitError('RESOURCE_LIMIT', 'Document grew beyond byte budget');
            chunks.push(buffer.subarray(0, bytesRead));
        }
        throw new KitError('RESOURCE_LIMIT', 'Document exceeds byte budget');
    } finally {
        await handle.close();
    }
}
