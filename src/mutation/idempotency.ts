import { KitError } from '../contracts/errors.js';
export class MutationLocks {
    private busy = new Set<string>();
    async run<T>(id: string, work: () => Promise<T>) { if (this.busy.has(id))
        throw new KitError('CONFLICT', 'Proposal apply already in progress; query status'); this.busy.add(id); try {
        return await work();
    }
    finally {
        this.busy.delete(id);
    } }
}
