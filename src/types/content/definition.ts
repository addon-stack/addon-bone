import type {ContentScriptPrepareHandler} from "./prepare";

import type {
    ContentScriptAnchor,
    ContentScriptAnchorGetter,
    ContentScriptAppend,
    ContentScriptContainerCreator,
    ContentScriptContainerFactory,
    ContentScriptContainerOptions,
    ContentScriptContainerTag,
    ContentScriptFramePageOptions,
    ContentScriptFrameRenderOptions,
    ContentScriptFrameSourceOptions,
    ContentScriptIsolation,
    ContentScriptIsolationFrameOptions,
    ContentScriptIsolationNoneOptions,
    ContentScriptIsolationOptions,
    ContentScriptIsolationShadowOptions,
    ContentScriptMainFunction,
    ContentScriptMarkerGetter,
    ContentScriptMarkerResolver,
    ContentScriptMarkerType,
    ContentScriptMountFunction,
    ContentScriptOptions,
    ContentScriptWatchStrategy,
} from "./common";

import type {ContentScriptRenderHandler, ContentScriptRenderValue} from "./render";

export interface ContentScriptDefinitionBase<Data = unknown> extends Partial<ContentScriptOptions> {
    marker?: ContentScriptMarkerType | ContentScriptMarkerGetter;
    anchor?: ContentScriptAnchor | ContentScriptAnchorGetter;
    mount?: ContentScriptMountFunction;

    container?:
        | ContentScriptContainerTag
        | ContentScriptContainerOptions
        | ContentScriptContainerFactory<NoInfer<Data>>;

    prepare?: ContentScriptPrepareHandler<Data>;
    watch?: true | ContentScriptWatchStrategy;
    main?: ContentScriptMainFunction;
}

export type ContentScriptDefinition<Data = unknown> = ContentScriptDefinitionBase<Data> &
    (
        | {
              isolation?:
                  | ContentScriptIsolation
                  | `${ContentScriptIsolation}`
                  | ContentScriptIsolationNoneOptions
                  | ContentScriptIsolationShadowOptions
                  | (ContentScriptIsolationFrameOptions & ContentScriptFrameRenderOptions);

              render?: ContentScriptRenderValue<NoInfer<Data>> | ContentScriptRenderHandler<NoInfer<Data>>;
          }
        | {
              isolation: ContentScriptIsolationFrameOptions &
                  (ContentScriptFramePageOptions | ContentScriptFrameSourceOptions);

              render?: never;
          }
    );

export interface ContentScriptResolvedDefinition<Data = unknown> extends Omit<
    ContentScriptDefinitionBase<Data>,
    "anchor" | "marker" | "mount" | "container" | "watch"
> {
    isolation: ContentScriptIsolationOptions;
    marker: ContentScriptMarkerResolver;
    anchor: ContentScriptAnchorGetter;
    mount: ContentScriptMountFunction;
    render?: true | ContentScriptRenderHandler<Data>;
    container: ContentScriptContainerCreator<Data>;
    watch: ContentScriptWatchStrategy;
}

type ContentScriptAppendVariant<T> = T extends unknown ? Omit<T, "mount"> & {append?: ContentScriptAppend} : never;

export type ContentScriptAppendDefinition<Data = unknown> = ContentScriptAppendVariant<ContentScriptDefinition<Data>>;
