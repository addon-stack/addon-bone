import {RelayGlobalKey} from "@typing/relay";

export const sleep = (time: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, time));
};

export const awaiter = async <T>(
    handler: () => Promise<T>,
    attempts: number = 1,
    retryTime: number = 100,
    defaults?: T
): Promise<T> => {
    if (attempts < 1) {
        throw new Error("Attempts less then 1");
    }

    const iterator = Array.from({length: attempts}, (_, i) => i).reverse();

    for await (const countdown of iterator) {
        try {
            return await handler();
        } catch (e) {
            console.log("Awaiter iteration error", e);

            if (countdown > 0) {
                await sleep(retryTime);
            }
        }
    }

    if (defaults === undefined) {
        throw new Error("Awaiter error");
    }

    return defaults;
};

export const isRelayContext = (): boolean => !!globalThis[RelayGlobalKey];
