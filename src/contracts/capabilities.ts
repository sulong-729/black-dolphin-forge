import { z } from 'zod';
import { KitError, errorInfo } from './errors.js';
import { validateEnvelope, ResultSchema, type RequestEnvelope, type ResultEnvelope } from './envelopes.js';
export type OwnerProcess = 'offline' | 'editor-main' | 'editor-scene' | 'preview-runtime' | 'native-runtime' | 'build-worker';
export type Availability = 'available' | 'requires-editor' | 'requires-play-mode' | 'requires-device' | 'unavailable' | 'experimental';
export interface Capability {
    name: string;
    area: string;
    process: OwnerProcess;
    readOnly: boolean;
    availability: Availability;
    inputSchema: z.ZodType;
    handler?: (params: any, request: RequestEnvelope) => Promise<unknown> | unknown;
    supportedCreatorVersions?: string[];
    description?: string;
}
export class Registry {
    private readonly entries = new Map<string, Capability>();
    constructor(private readonly authorize: (cap: Capability, request: RequestEnvelope) => boolean = () => false) { }
    register(capability: Capability) {
        if (this.entries.has(capability.name))
            throw new KitError('CONFLICT', 'Duplicate capability: ' + capability.name);
        this.entries.set(capability.name, { ...capability });
    }
    describe(operation?: string) {
        const values = operation ? [this.entries.get(operation)].filter(Boolean) as Capability[] : [...this.entries.values()];
        if (operation && !values.length)
            throw new KitError('UNKNOWN_OPERATION', 'Unknown operation: ' + operation, 'Use describe to discover available operations.');
        return values.map(({ handler, inputSchema, ...publicMetadata }) => ({ ...publicMetadata,
            ...(operation ? { inputSchema: z.toJSONSchema(inputSchema), outputSchema: z.toJSONSchema(ResultSchema), preconditions: { source: publicMetadata.process.startsWith('editor') ? 'editor' : publicMetadata.process.endsWith('runtime') ? 'runtime' : 'disk', availability: publicMetadata.availability, trustedAuthorization: !publicMetadata.readOnly } } : {}),
        }));
    }
    async dispatch(input: unknown): Promise<ResultEnvelope> {
        let requestId = typeof (input as any)?.requestId === 'string' ? (input as any).requestId.slice(0, 128) : 'invalid-request';
        try {
            const request = validateEnvelope(input);
            requestId = request.requestId;
            const cap = this.entries.get(request.operation);
            if (!cap)
                throw new KitError('UNKNOWN_OPERATION', 'Unknown operation: ' + request.operation, 'Use describe; arbitrary code/shell execution is not supported.');
            const params = cap.inputSchema.safeParse(request.params);
            if (!params.success)
                throw new KitError('SCHEMA_MISMATCH', 'Invalid operation params: ' + params.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
            if (cap.availability !== 'available' || !cap.handler)
                throw new KitError('UNAVAILABLE_CAPABILITY', `${cap.name}: ${cap.availability}`, 'Inspect capability requirements; no fallback will be executed.');
            if (cap.supportedCreatorVersions && !cap.supportedCreatorVersions.includes(request.creatorVersion || ''))
                throw new KitError('UNAVAILABLE_CAPABILITY', 'Creator version not qualified for this operation');
            const expectedSource = cap.process.startsWith('editor') ? 'editor' : cap.process.endsWith('runtime') ? 'runtime' : 'disk';
            if (request.source !== expectedSource)
                throw new KitError('PROCESS_MISMATCH', `Operation requires ${expectedSource}/${cap.process}; source was ${request.source}`);
            if (!cap.readOnly && !this.authorize(cap, request))
                throw new KitError('AUTHORIZATION_REQUIRED', 'Trusted task/user authorization required; client flags do not grant it');
            const data = await cap.handler(params.data, request);
            return { formatVersion: 1, requestId, status: 'ok', source: request.source, data, warnings: [] };
        }
        catch (error) {
            return { formatVersion: 1, requestId, status: 'error', warnings: [], error: errorInfo(error) };
        }
    }
}
