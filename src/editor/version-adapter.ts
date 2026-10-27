import {creatorAdapter} from '../compatibility/versions.js';
import { KitError } from '../contracts/errors.js';
export interface EditorState {
    document: string;
    stage: 'scene' | 'prefab' | 'none';
    revision: string;
    schema: string;
    importing: boolean;
    dirty: boolean;
}
export interface Handshake {
    projectId: string;
    creatorVersion: string;
    engineVersion: string;
    instance: string;
    features: Record<string, boolean>;
    state: EditorState;
}
export function qualify(hello: Handshake) {
    const adapter = creatorAdapter(hello.creatorVersion);
    if (hello.engineVersion !== adapter.version || !['scene', 'registry', 'attributes'].every(key => hello.features[key] === true))
        throw new KitError('UNAVAILABLE_CAPABILITY', 'Editor requires matching Creator/engine versions and scene/registry/attributes probes');
    return 'creator-'+adapter.version+'-read-v1';
}
