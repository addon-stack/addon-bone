export const serviceName = "math";

export const mathService = {
    sum: (a: number, b: number): number => a + b,
    asyncSum: (a: number, b: number): Promise<number> => {
        return new Promise(resolve => setTimeout(() => resolve(a + b), 100));
    },
    fail: (): never => {
        throw new TypeError("background failed");
    },
    one: 1,
    obj: {
        concat: (a: string, b: string): string => a + " " + b,
        zero: 0,
    },
};

export type MathService = typeof mathService;
