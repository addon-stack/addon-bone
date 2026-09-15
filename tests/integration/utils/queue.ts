import {availableParallelism} from "node:os";

export const fixtureWorkers = (): number => {
    const value = process.env.ADNBN_TEST_WORKERS;
    const workers = value === undefined ? Math.min(4, availableParallelism()) : Number(value);
    if (!Number.isSafeInteger(workers) || workers < 1) {
        throw new Error("ADNBN_TEST_WORKERS must be a positive integer");
    }
    return workers;
};

/** Finish running work before reporting failures; never leave child processes behind. */
export const runQueue = async <T>(
    items: readonly T[],
    workers: number,
    action: (item: T) => Promise<void>
): Promise<void> => {
    if (!Number.isSafeInteger(workers) || workers < 1) throw new Error("workers must be a positive integer");
    let next = 0;
    const errors: unknown[] = [];
    await Promise.all(
        Array.from({length: Math.min(workers, items.length)}, async () => {
            while (next < items.length) {
                const item = items[next++];
                try {
                    await action(item);
                } catch (error) {
                    errors.push(error);
                }
            }
        })
    );
    if (errors.length) throw new AggregateError(errors, `${errors.length} fixture task(s) failed`);
};
