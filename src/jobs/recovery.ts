import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { digest } from '../mutation/policy.js';
import { KitError } from '../contracts/errors.js';
// Trusted local-user attestation: inspect/stop old owned workers before this call.
// Never exposed through RPC/MCP; never kills any historical PID.
export async function reconcileJob(directory: string, id: string, hash: string) { if (!/^[a-f0-9-]{36}$/.test(id))
    throw new KitError('NOT_FOUND', 'Invalid job id'); const record = JSON.parse(await readFile(path.join(directory, id, 'job.json'), 'utf8')); if (record.status !== 'interrupted' || hash !== digest(record))
    throw new KitError('CONFLICT', 'Review current interrupted job and exact reconciliation hash'); await writeFile(path.join(directory, id, 'reconcile.json'), JSON.stringify({ hash, created: Date.now() }), { mode: 0o600 }); return { job: id, reconciled: true, hash }; }
