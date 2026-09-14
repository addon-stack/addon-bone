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

export interface ContentScriptDefinitionBase extends Partial<ContentScriptOptions> {
    marker?: ContentScriptMarkerType | ContentScriptMarkerGetter;
    anchor?: ContentScriptAnchor | ContentScriptAnchorGetter;
    mount?: ContentScriptMountFunction;
    container?: ContentScriptContainerTag | ContentScriptContainerOptions | ContentScriptContainerFactory;
    watch?: true | ContentScriptWatchStrategy;
    main?: ContentScriptMainFunction;
}

export type ContentScriptDefinition = ContentScriptDefinitionBase &
    (
        | {
              isolation?:
                  | ContentScriptIsolation
                  | `${ContentScriptIsolation}`
                  | ContentScriptIsolationNoneOptions
                  | ContentScriptIsolationShadowOptions
                  | (ContentScriptIsolationFrameOptions & ContentScriptFrameRenderOptions);
              render?: ContentScriptRenderValue | ContentScriptRenderHandler;
          }
        | {
              isolation: ContentScriptIsolationFrameOptions &
                  (ContentScriptFramePageOptions | ContentScriptFrameSourceOptions);
              render?: never;
          }
    );

export interface ContentScriptResolvedDefinition extends Omit<
    ContentScriptDefinitionBase,
    "anchor" | "marker" | "mount" | "container" | "watch"
> {
    isolation: ContentScriptIsolationOptions;
    marker: ContentScriptMarkerResolver;
    anchor: ContentScriptAnchorGetter;
    mount: ContentScriptMountFunction;
    render?: ContentScriptRenderHandler;
    container: ContentScriptContainerCreator;
    watch: ContentScriptWatchStrategy;
}

type ContentScriptAppendVariant<T> = T extends unknown ? Omit<T, "mount"> & {append?: ContentScriptAppend} : never;

export type ContentScriptAppendDefinition = ContentScriptAppendVariant<ContentScriptDefinition>;
