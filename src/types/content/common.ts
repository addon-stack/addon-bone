import type {ContentScriptPrepareProps} from "./prepare";

import type {PageAlias} from "@typing/page";
import type {Optional} from "utility-types";

import type {EntrypointBuilder, EntrypointOptions} from "@typing/entrypoint";
import type {Awaiter, PickNonFunctionProperties} from "@typing/helpers";

export const ContentScriptMatches = ["http://*/*", "https://*/*"];

/** Shared property used by the bundler plugin and the content script's style runtime getter. */
export const ContentScriptStylesRuntimeProperty = "__adnbnIsolatedStyles";

export enum ContentScriptWorld {
    Isolated = "ISOLATED",
    Main = "MAIN",
}

export enum ContentScriptDeclarative {
    Required = "required",
    Optional = "optional",
}

export enum ContentScriptIsolation {
    None = "none",
    Shadow = "shadow",
    Iframe = "iframe",
}

export enum ContentScriptShadowMode {
    Open = "open",
    Closed = "closed",
}

// Append
export enum ContentScriptAppend {
    Last = "last",
    First = "first",
    Replace = "replace",
    Before = "before",
    After = "after",
}

// Marker
export enum ContentScriptMarker {
    /** In-memory marking (no DOM mutations). */
    Weak = "weak",
    /** DOM attribute-based marking. */
    Attribute = "attribute",
}

export enum ContentScriptMarkerValue {
    Mounted = "1",
    Unmounted = "0",
}

// Event
export enum ContentScriptEvent {
    Mount = "mount",
    Unmount = "unmount",
    Add = "add",
    Remove = "remove",
}

type RunAt = chrome.extensionTypes.RunAt;

export interface ContentScriptStylesRuntime {
    /** Resolves initial stylesheet URLs once, before the first root is registered. */
    initialize(resolveUrl: (file: string) => string): void;
    /** Retry restored styles once on load error; future loads keep the default failure behavior. */
    add(root: ShadowRoot | HTMLElement, target: Element | null, retry?: boolean): void;
    delete(root: ShadowRoot | HTMLElement): void;
    load(url: string): Promise<void>;
}

export type ContentScriptWorldValue = ContentScriptWorld | `${chrome.scripting.ExecutionWorld}`;

export interface ContentScriptConfig {
    matches?: string[];
    /**
     * See https://developer.chrome.com/docs/extensions/mv3/content_scripts/
     * @default []
     */
    excludeMatches?: string[];
    /**
     * See https://developer.chrome.com/docs/extensions/mv3/content_scripts/
     * @default []
     */
    includeGlobs?: string[];
    /**
     * See https://developer.chrome.com/docs/extensions/mv3/content_scripts/
     * @default []
     */
    excludeGlobs?: string[];
    /**
     * See https://developer.chrome.com/docs/extensions/mv3/content_scripts/
     * @default false
     */
    allFrames?: boolean;
    /**
     * See https://developer.chrome.com/docs/extensions/mv3/content_scripts/
     * @default "documentIdle"
     */
    runAt?: RunAt;
    /**
     * See https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#isolated_world
     *
     * Dynamic imports keep physical async chunks in ISOLATED. MAIN keeps the same Promise-based
     * execution semantics but includes dynamic dependencies in the initial entrypoint graph.
     * Manifest V2 builds always use ISOLATED. Requesting MAIN emits a build warning and applies
     * ISOLATED grouping and chunk loading rules before generating the manifest.
     */
    world?: ContentScriptWorldValue;
    /**
     * See https://developer.chrome.com/docs/extensions/mv3/content_scripts/
     * @default false
     */
    matchAboutBlank?: boolean;
    /**
     * See https://developer.chrome.com/docs/extensions/mv3/content_scripts/
     * @default false
     */
    matchOriginAsFallback?: boolean;
    /**
     * Whether this content script requires explicit host permission declaration in the extension manifest.
     *
     * Accepted values:
     * - ContentScriptDeclarative.Required — adds the corresponding host patterns to manifest.host_permissions.
     * - ContentScriptDeclarative.Optional — adds the corresponding host patterns to manifest.optional_host_permissions.
     *
     * Backward compatibility:
     * - true ≡ ContentScriptDeclarative.Required
     * - false ≡ undefined (as if the value is not set)
     *
     * @see https://developer.chrome.com/docs/extensions/mv3/declare_permissions/
     *
     * @default undefined
     */
    declarative?: boolean | `${ContentScriptDeclarative}` | ContentScriptDeclarative;
}

export type ContentScriptOptions = ContentScriptConfig & EntrypointOptions;

export interface ContentScriptShadowOptions {
    /**
     * Controls access through the host's shadowRoot property, not CSS isolation or UI visibility.
     * @default ContentScriptShadowMode.Open
     */
    mode?: ContentScriptShadowMode | `${ContentScriptShadowMode}`;
}

export interface ContentScriptFrameOptions {
    width?: number | string;
    /** Defaults to 150px. Automatic height is not supported yet. */
    height?: number | string;
}

export interface ContentScriptFrameRenderOptions extends ContentScriptFrameOptions {
    page?: never;
    src?: never;
}

export interface ContentScriptFramePageOptions extends ContentScriptFrameOptions {
    page: PageAlias;
    src?: never;
}

export interface ContentScriptFrameSourceOptions extends ContentScriptFrameOptions {
    src: string;
    page?: never;
}

export type ContentScriptFrame =
    | ContentScriptFrameRenderOptions
    | ContentScriptFramePageOptions
    | ContentScriptFrameSourceOptions;

export interface ContentScriptIsolationNoneOptions {
    type: ContentScriptIsolation.None | "none";
    mode?: never;
    page?: never;
    src?: never;
    width?: never;
    height?: never;
}

export interface ContentScriptIsolationShadowOptions extends ContentScriptShadowOptions {
    type: ContentScriptIsolation.Shadow | "shadow";
    page?: never;
    src?: never;
    width?: never;
    height?: never;
}

export type ContentScriptIsolationFrameOptions = ContentScriptFrame & {
    type: ContentScriptIsolation.Iframe | "iframe";
    mode?: never;
};

/** Object form of isolation, also used after resolving shorthand values. */
export type ContentScriptIsolationOptions =
    | ContentScriptIsolationNoneOptions
    | ContentScriptIsolationShadowOptions
    | ContentScriptIsolationFrameOptions;

export type ContentScriptIsolationValue =
    | ContentScriptIsolation
    | `${ContentScriptIsolation}`
    | ContentScriptIsolationOptions;

/** Statically resolved configuration; runtime render values are never retained here. */
export type ContentScriptEntrypointOptions = Partial<ContentScriptOptions> & {
    isolation?: ContentScriptIsolationOptions;
};

// Mount
export type ContentScriptMountFunction = (anchor: Element, container: Element) => void | (() => void);

export interface ContentScriptMount {
    mount(): boolean | undefined | void;

    unmount(): boolean | undefined | void;
}

// Props
export interface ContentScriptContainerProps<Data = unknown> extends ContentScriptPrepareProps {
    data: Data;
}

export interface ContentScriptProps<Data = unknown> extends ContentScriptContainerProps<Data> {
    /** Outer mounted element; the Shadow host or iframe wrapper when isolated. */
    container: Element;
    /** Actual render destination. Use its root/document for portals and DOM operations. */
    target: Element;
}

// Anchor
export type ContentScriptAnchor = string | Element | null | undefined;

export type ContentScriptAnchorGetter = () => Awaiter<ContentScriptAnchor>;

export interface ContentScriptMarkerContract {
    for(anchor: ContentScriptAnchor): ContentScriptMarkerContract;

    /**
     * Returns elements that are not tracked yet (no marker attribute present).
     * MUST NOT mutate marker state.
     */
    unmarked(): Element[];

    marked(): Element[];

    mark(element: Element, value: ContentScriptMarkerValue): boolean;

    unmark(element: Element): boolean;

    isMarked(element: Element): boolean;

    value(element: Element): ContentScriptMarkerValue | undefined;

    mount(element: Element): boolean;

    unmount(element: Element): boolean;

    reset(): ContentScriptMarkerContract;
}

export type ContentScriptMarkerType =
    | ContentScriptMarker
    | `${ContentScriptMarker}`
    | ContentScriptMarkerContract
    | undefined;

export type ContentScriptMarkerGetter = (options: ContentScriptOptions) => Awaiter<ContentScriptMarkerType>;

export type ContentScriptMarkerResolver = (options: ContentScriptOptions) => Awaiter<ContentScriptMarkerContract>;

// Container
export type ContentScriptContainerTag = Exclude<keyof HTMLElementTagNameMap, "html" | "body">;

export type ContentScriptContainerOptions = {
    [Tag in ContentScriptContainerTag]: {
        tagName: Tag;
    } & Exclude<Optional<PickNonFunctionProperties<HTMLElementTagNameMap[Tag]>>, "id">;
}[ContentScriptContainerTag];

export type ContentScriptContainerFactory<Data = unknown> = (
    props: ContentScriptContainerProps<Data>
) => Awaiter<Element | ContentScriptContainerTag | ContentScriptContainerOptions>;

export type ContentScriptContainerCreator<Data = unknown> = (
    props: ContentScriptContainerProps<Data>
) => Awaiter<Element>;

// Watch
export type ContentScriptWatchStrategy = (update: () => Awaiter<void>, context: ContentScriptContext) => () => void;

export type ContentScriptEventCallback = (event: ContentScriptEvent, node: ContentScriptNode) => void;

export interface ContentScriptEventEmitter {
    on(callback: ContentScriptEventCallback): void;

    off(callback: ContentScriptEventCallback): void;

    emit(event: ContentScriptEvent, node: ContentScriptNode): void;

    emitMount(node: ContentScriptNode): void;

    emitUnmount(node: ContentScriptNode): void;

    emitAdd(node: ContentScriptNode): void;

    emitRemove(node: ContentScriptNode): void;

    removeAllListeners(): void;

    listenerCount(): number;

    hasListeners(): boolean;
}

// Context
export interface ContentScriptContext extends ContentScriptMount {
    nodes: ReadonlySet<ContentScriptNode>;

    /**
     * Registers a callback function that will be invoked when a specific content script context event occurs.
     *
     * @param {ContentScriptEventCallback} callback - The function to be executed when the event is triggered. Receives event-related data as its argument.
     * @return {Function} A function that can be called to unsubscribe the callback from the event.
     */
    watch(callback: ContentScriptEventCallback): () => void;

    /**
     * Stops watching for changes or events that were previously being observed.
     * Unsubscribes from all event listeners that were registered through the watch method.
     *
     * @return {void} No return value.
     */
    unwatch(): void;
}

// Main
export type ContentScriptMainFunction = (context: ContentScriptContext, options: ContentScriptOptions) => Awaiter<void>;

// Node
export interface ContentScriptNode extends ContentScriptMount {
    anchor: Element;
    container?: Element;

    /** Element used by the active adapter as the destination for rendered UI. */
    target?: Element;
}

export type ContentScriptNodeSet = Set<ContentScriptNode>;

// Builder
export interface ContentScriptBuilder extends EntrypointBuilder {
    getContext(): ContentScriptContext;
}
