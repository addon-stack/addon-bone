import type {ContentScriptPrepareHandler} from "./prepare";
import type {ContentScriptBoundaryHandler} from "./boundary";

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
import type {ContentScriptTarget, ContentScriptTargetCreator} from "./target";

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

export type ContentScriptRenderDefinition<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = {
    // Infer the mode only from configuration; callbacks consume that mode without widening it.
    isolation?: Isolation | {type: Isolation};
    boundary?: ContentScriptBoundaryHandler<NoInfer<Data>, NoInfer<Isolation>>;
    target?: ContentScriptTarget<NoInfer<Data>, NoInfer<Isolation>>;
    render?:
        | ContentScriptRenderValue<NoInfer<Data>, NoInfer<Isolation>>
        | ContentScriptRenderHandler<NoInfer<Data>, NoInfer<Isolation>>;
} & (
    | {
          isolation?:
              | NoInfer<Isolation>
              | Extract<ContentScriptIsolationOptions, {type: `${NoInfer<Isolation>}`; page?: never; src?: never}>;
          boundary?: never;
          target?: never;
      }
    | {
          isolation:
              | Extract<NoInfer<Isolation>, "shadow">
              | Extract<ContentScriptIsolationShadowOptions, {type: `${NoInfer<Isolation>}`}>;
      }
    | {
          isolation:
              | Extract<NoInfer<Isolation>, "iframe">
              | Extract<
                    ContentScriptIsolationFrameOptions & ContentScriptFrameRenderOptions,
                    {type: `${NoInfer<Isolation>}`}
                >;
      }
    | {
          isolation: Extract<
              ContentScriptIsolationFrameOptions & (ContentScriptFramePageOptions | ContentScriptFrameSourceOptions),
              {type: `${NoInfer<Isolation>}`}
          >;
          render?: never;
          target?: never;
      }
) &
    ("none" extends `${NoInfer<Isolation>}` ? unknown : {isolation: unknown});

export type ContentScriptDefinition<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = ContentScriptDefinitionBase<Data> & ContentScriptRenderDefinition<Data, Isolation>;

export interface ContentScriptResolvedDefinition<Data = unknown> extends Omit<
    ContentScriptDefinitionBase<Data>,
    "anchor" | "marker" | "mount" | "container" | "watch"
> {
    isolation: ContentScriptIsolationOptions;
    boundary?: ContentScriptBoundaryHandler<Data>;
    marker: ContentScriptMarkerResolver;
    anchor: ContentScriptAnchorGetter;
    mount: ContentScriptMountFunction;
    render?: true | ContentScriptRenderHandler<Data>;
    container: ContentScriptContainerCreator<Data>;
    target: ContentScriptTargetCreator<Data>;
    watch: ContentScriptWatchStrategy;
}

export type ContentScriptAppendDefinition<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = Omit<ContentScriptDefinitionBase<Data>, "mount"> &
    ContentScriptRenderDefinition<Data, Isolation> & {append?: ContentScriptAppend};
