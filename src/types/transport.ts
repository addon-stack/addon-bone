import {Required} from "utility-types";

import {MessageSendOptions} from "@message/providers";

import {EntrypointOptions} from "@typing/entrypoint";
import {Awaiter, DeepAsyncProxy} from "@typing/helpers";
import {MessageSender} from "@typing/message";

export type TransportType = ((...args: any[]) => Promise<any>) | {[key: string]: any | TransportType};

export interface TransportDictionary {
    [key: string]: any;
}

export type TransportName = Extract<keyof TransportDictionary, string>;

export type TransportTarget<T extends TransportDictionary, K extends keyof T> = T[K];

export type TransportProxyTarget<T extends TransportDictionary, K extends keyof T> = DeepAsyncProxy<T[K]>;

export interface TransportManager {
    add<K extends TransportName>(name: K, instance: TransportDictionary[K]): this;

    get<K extends TransportName>(name: K): TransportDictionary[K] | undefined;

    has(name: TransportName): boolean;

    remove<K extends TransportName>(name: K): TransportDictionary[K] | undefined;

    clear(): this;
}

export interface TransportMessageData {
    path?: string;
    args: any[];
}

export interface TransportMessage {
    send(data: TransportMessageData, options?: MessageSendOptions): any;

    watch(handler: (data: TransportMessageData, sender: MessageSender) => any): void;
}

export interface TransportProvider<T extends TransportType> {
    get(): T;

    destroy(): void;
}

export interface TransportRegister<T extends TransportType, A extends any[] = []> extends TransportProvider<T> {
    register(...args: A): T;
}

export interface TransportConfig {
    name: string;
}

export type TransportOptions = TransportConfig & EntrypointOptions;

export type TransportEntrypointOptions = Partial<TransportOptions>;

export type TransportInitGetter<O extends TransportEntrypointOptions, T extends TransportType> = (options: O) => T;

export type TransportMainHandler<O extends TransportEntrypointOptions, T extends TransportType> = (
    instance: T,
    options: O
) => Awaiter<void>;

export type TransportDefinition<O extends TransportOptions, T extends TransportType> = TransportEntrypointOptions & {
    init: TransportInitGetter<O, T>;
    main?: TransportMainHandler<O, T>;
};

export type TransportUnresolvedDefinition<O extends TransportOptions, T extends TransportType> = Partial<
    TransportDefinition<O, T>
>;

export type TransportResolvedDefinition<O extends TransportOptions, T extends TransportType> = Required<
    TransportDefinition<O, T>,
    "name" | "init"
>;
