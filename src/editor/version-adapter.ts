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
    if (hello.creatorVersion !== '3.7.3' || hello.engineVersion !== '3.7.3' || !['scene', 'registry', 'attributes'].every(key => hello.features[key] === true))
        throw new KitError('UNAVAILABLE_CAPABILITY', 'Editor requires Creator/engine 3.7.3 and scene/registry/attributes probes');
    return 'creator-3.7.3-read-v1';
}
