export const errorCodes = [
    'AMBIGUOUS_TARGET', 'UNSUPPORTED_OPERATION', 'INTEGRITY_ERROR', 'SCHEMA_MISMATCH', 'UNKNOWN_OPERATION', 'UNAVAILABLE_CAPABILITY', 'PROCESS_MISMATCH',
    'AUTHORIZATION_REQUIRED', 'FOREIGN_PROJECT', 'PATH_OUTSIDE_PROJECT', 'STALE_REVISION',
    'STALE_HANDLE', 'SNAPSHOT_EXPIRED', 'CURSOR_MISMATCH', 'RESOURCE_LIMIT',
    'NOT_FOUND', 'CONFLICT', 'REQUEST_TOO_LARGE', 'UNAUTHORIZED', 'INTERNAL_ERROR',
] as const;
export type ErrorCode = typeof errorCodes[number];
export class KitError extends Error {
    constructor(public readonly code: ErrorCode, message: string, public readonly recovery = 'Inspect the error and retry with a valid request.') {
        super(message);
        this.name = 'KitError';
    }
}
export function errorInfo(error: unknown) {
    if (error instanceof KitError)
        return { code: error.code, message: error.message, recovery: error.recovery };
    return { code: 'INTERNAL_ERROR' as const, message: 'Operation failed. Inspect the local diagnostic log.', recovery: 'Run doctor; do not retry a write without reconciling its outcome.' };
}
