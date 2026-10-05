export type Awaiter<T> = T | Promise<T>;

export type PickNonFunctionProperties<T> = {
    [K in keyof T as T[K] extends Function ? never : K]: T[K];
};
