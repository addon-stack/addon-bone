import {EntrypointOptions} from "@typing/entrypoint";
import {ContentScriptConfig, ContentScriptContext, ContentScriptDefinition} from "@typing/content";
import {TransportConfig, TransportDefinition, TransportType, type TransportProxyTarget} from "@typing/transport";
import {Awaiter} from "@typing/helpers";
import type {MessageError} from "@typing/message";
import type {RelayRegistry} from "@relay/index";

export const RelayGlobalKey = "adnbnRelay";

export enum RelayMethod {
    Scripting = "scripting",
    Messaging = "messaging",
}

export enum RelayAllFrames {
    /**
     * Executes the method in every frame reached by the selected transport and returns one outcome:
     * Scripting prefers a fulfilled result, while Messaging returns the first response.
     *
     * Warning: mutating methods can execute in multiple frames even though only one outcome is returned.
     */
    Any = "any",

    /** Executes the method in every discovered frame and returns an outcome for each frame. */
    All = "all",
}

export enum RelayFrameErrorKind {
    Remote = "remote",
    Execution = "execution",
    Delivery = "delivery",
    Timeout = "timeout",
    TargetGone = "target-gone",
    Unobservable = "unobservable",
}

export type RelayNonEmptyReadonlyArray<T> = readonly [T, ...T[]];

export interface RelayExecutionOptions {
    /** Maximum execution time per addressed Messaging frame or for the Inject Script operation. */
    timeoutMs?: number;
}

interface RelayTargetBase extends RelayExecutionOptions {
    tabId: number;
}

export interface RelayTopFrameOptions extends RelayTargetBase {
    allFrames?: false;
    frameId?: never;
    frameIds?: never;
    documentId?: never;
    documentIds?: never;
}

export interface RelayFrameOptions extends RelayTargetBase {
    frameId: number;
    allFrames?: never;
    frameIds?: never;
    documentId?: never;
    documentIds?: never;
}

export interface RelayFramesOptions extends RelayTargetBase {
    frameIds: RelayNonEmptyReadonlyArray<number>;
    allFrames?: never;
    frameId?: never;
    documentId?: never;
    documentIds?: never;
}

export interface RelayDocumentOptions extends RelayTargetBase {
    documentId: string;
    allFrames?: never;
    frameId?: never;
    frameIds?: never;
    documentIds?: never;
}

export interface RelayDocumentsOptions extends RelayTargetBase {
    documentIds: RelayNonEmptyReadonlyArray<string>;
    allFrames?: never;
    frameId?: never;
    frameIds?: never;
    documentId?: never;
}

/**
 * Broadcasts the call to all frames without requiring an exhaustive frame list and returns one outcome.
 * `true` is an alias for `RelayAllFrames.Any`.
 *
 * Warning: mutating methods can execute in multiple frames even though only one outcome is returned.
 */
export interface RelayAnyFramesOptions extends RelayTargetBase {
    allFrames: true | RelayAllFrames.Any;
    frameId?: never;
    frameIds?: never;
    documentId?: never;
    documentIds?: never;
}

export interface RelayEveryFrameOptions extends RelayTargetBase {
    allFrames: RelayAllFrames.All;
    frameId?: never;
    frameIds?: never;
    documentId?: never;
    documentIds?: never;
}

export type RelayAllFramesOptions = RelayAnyFramesOptions | RelayEveryFrameOptions;

export type RelayScalarOptions = RelayTopFrameOptions | RelayFrameOptions | RelayDocumentOptions;

export type RelayBatchOptions = RelayFramesOptions | RelayDocumentsOptions | RelayAllFramesOptions;

export type RelayCallOptions = RelayScalarOptions | RelayBatchOptions;

export type RelayAddressTarget =
    | {
          tabId: number;
          frameId: number;
          documentId?: string;
          allFrames?: never;
      }
    | {
          tabId: number;
          frameId?: never;
          documentId: string;
          allFrames?: never;
      };

export type RelayOperationTarget = {
    tabId: number;
    allFrames: RelayAllFrames;
    frameId?: never;
    documentId?: never;
};

export type RelayResultTarget = RelayAddressTarget | RelayOperationTarget;

export interface RelayFrameError extends MessageError {
    kind: RelayFrameErrorKind;
}

export type RelayFrameResult<T> =
    | {
          target: RelayResultTarget;
          status: "fulfilled";
          result: T;
      }
    | {
          target: RelayResultTarget;
          status: "rejected";
          error: RelayFrameError;
      };

export type RelayFramesResult<T> = readonly RelayFrameResult<T>[];

export type RelayBatchRpcProxy<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any
        ? (...args: Parameters<T[K]>) => Promise<RelayFramesResult<Awaited<ReturnType<T[K]>>>>
        : T[K] extends object
          ? RelayBatchRpcProxyObject<T[K]>
          : () => Promise<RelayFramesResult<Awaited<T[K]>>>;
};

export type RelayBatchRpcProxyObject<T> = (() => Promise<RelayFramesResult<Awaited<T>>>) & RelayBatchRpcProxy<T>;

export type RelayProxyTarget<N extends keyof RelayRegistry> = TransportProxyTarget<RelayRegistry, N>;

export type RelayBatchProxyTarget<N extends keyof RelayRegistry> = RelayBatchRpcProxy<RelayRegistry[N]>;

export interface RelayConfig extends TransportConfig, Omit<ContentScriptConfig, "allFrames"> {
    allFrames?: boolean | RelayAllFrames;
    method?: RelayMethod;
}

export type RelayOptions = RelayConfig & EntrypointOptions;

export type RelayOptionsMap = Map<string, RelayOptions>;

export type RelayEntrypointOptions = Partial<RelayOptions>;

export type RelayMainHandler<T extends TransportType> = (
    relay: T,
    context: ContentScriptContext,
    options: RelayEntrypointOptions
) => Awaiter<void>;

export interface RelayDefinition<T extends TransportType>
    extends
        Omit<TransportDefinition<RelayOptions, T>, "main">,
        Omit<ContentScriptDefinition, "main" | "allFrames">,
        RelayEntrypointOptions {
    main?: RelayMainHandler<T>;
}

export type RelayUnresolvedDefinition<T extends TransportType> = Partial<RelayDefinition<T>>;
