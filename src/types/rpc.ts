export type RpcAsyncProxy<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any
        ? (...args: Parameters<T[K]>) => Promise<Awaited<ReturnType<T[K]>>>
        : T[K] extends object
          ? RpcAsyncProxyObject<T[K]>
          : () => Promise<Awaited<T[K]>>;
};

export type RpcAsyncProxyObject<T> = (() => Promise<RpcAsyncProxy<T>>) & RpcAsyncProxy<T>;
