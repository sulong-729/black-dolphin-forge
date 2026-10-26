import { captureSources, type SourceCapture } from './roots.js';
import { KitError } from '../contracts/errors.js';
export async function assertFresh(capture: SourceCapture) {
    const current = await captureSources(capture.root, capture.options);
    if (current.revision !== capture.revision || current.engine !== capture.engine)
        throw new KitError('STALE_REVISION', 'Source inventory/content changed; recapture and resolve symbols again');
}
