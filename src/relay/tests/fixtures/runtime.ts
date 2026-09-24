import RelayManager from "@relay/RelayManager";
import RegisterRelay from "@relay/providers/RegisterRelay";
import {RelayMethod} from "@typing/relay";

const math = {
    sum: (a: number, b: number): number => a + b,
    asyncSum: (a: number, b: number): Promise<number> => new Promise(resolve => setTimeout(() => resolve(a + b), 100)),
    activation: (): boolean => {
        globalThis.relayFixture.started = true;

        return true;
    },
    fail: (): never => {
        throw new TypeError("Remote failure");
    },
    reject: (): Promise<never> => Promise.reject(new RangeError("Async failure")),
    empty: (): void => {},
    nullable: (): null => null,
    one: 1,
    obj: {concat: (a: string, b: string): string => `${a} ${b}`, zero: 0},
};

globalThis.relayFixture = {
    started: false,
    register: () => new RegisterRelay("math", RelayMethod.Scripting, () => math).register(),
    has: () => RelayManager.getInstance().has("math"),
};

export type RelayFixture = typeof math;
