import type {FC, ReactNode} from "react";
import {Optional} from "utility-types";

import {EntrypointBuilder, EntrypointOptions} from "@typing/entrypoint";
import {Awaiter, PickNonFunctionProperties} from "@typing/helpers";

type ExecutionWorld = chrome.scripting.ExecutionWorld;
type RunAt = chrome.extensionTypes.RunAt;

export const ContentScriptMatches = ["http://*/*", "https://*/*"];

export enum ContentScriptDeclarative {
    Required = "required",
    Optional = "optional",
}

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
     */
    world?: ExecutionWorld;
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

export type ContentScriptEntrypointOptions = Partial<ContentScriptOptions>;

// Append
export enum ContentScriptAppend {
    Last = "last",
    First = "first",
    Replace = "replace",
    Before = "before",
    After = "after",
}

// Mount
export type ContentScriptMountFunction = (anchor: Element, container: Element) => void | (() => void);

export interface ContentScriptMount {
    mount(): boolean | undefined | void;

    unmount(): boolean | undefined | void;
}

// Props
export interface ContentScriptProps extends ContentScriptEntrypointOptions {
    anchor: Element;
}

// Anchor
export type ContentScriptAnchor = string | Element | null | undefined;
export type ContentScriptAnchorGetter = () => Awaiter<ContentScriptAnchor>;
export type ContentScriptAnchorResolver = () => Awaiter<Element[]>;

// Render
export type ContentScriptRenderReactComponent = FC<ContentScriptProps>;
export type ContentScriptRenderValue = Element | ReactNode | ContentScriptRenderReactComponent;
export type ContentScriptRenderHandler = (props: ContentScriptProps) => Awaiter<undefined | ContentScriptRenderValue>;

// Container
export type ContentScriptContainerTag = Exclude<keyof HTMLElementTagNameMap, "html" | "body">;

export type ContentScriptContainerOptions = {
    [Tag in ContentScriptContainerTag]: {
        tagName: Tag;
    } & Exclude<Optional<PickNonFunctionProperties<HTMLElementTagNameMap[Tag]>>, "id">;
}[ContentScriptContainerTag];

export type ContentScriptContainerFactory = (
    props: ContentScriptProps
) => Awaiter<Element | ContentScriptContainerTag | ContentScriptContainerOptions>;
export type ContentScriptContainerCreator = (props: ContentScriptProps) => Awaiter<Element>;

// Watch
export type ContentScriptWatchStrategy = (update: () => void, context: ContentScriptContext) => () => void;

// Event
export enum ContentScriptEvent {
    Mount = "mount",
    Unmount = "unmount",
    Add = "add",
    Remove = "remove",
}

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
}

export type ContentScriptNodeSet = Set<ContentScriptNode>;

// Definition
export interface ContentScriptDefinition extends ContentScriptEntrypointOptions {
    anchor?: ContentScriptAnchor | ContentScriptAnchorGetter;
    mount?: ContentScriptMountFunction;
    render?: ContentScriptRenderValue | ContentScriptRenderHandler;
    container?: ContentScriptContainerTag | ContentScriptContainerOptions | ContentScriptContainerFactory;
    watch?: true | ContentScriptWatchStrategy;
    main?: ContentScriptMainFunction;
}

// prettier-ignore
export interface ContentScriptResolvedDefinition extends Omit<ContentScriptDefinition, "anchor" | "mount" | "container" | "render" | "watch"> {
    anchor: ContentScriptAnchorResolver;
    mount: ContentScriptMountFunction;
    render?: ContentScriptRenderHandler;
    container: ContentScriptContainerCreator;
    watch: ContentScriptWatchStrategy;
}

export interface ContentScriptAppendDefinition extends Omit<ContentScriptDefinition, "mount"> {
    append?: ContentScriptAppend;
}

// Builder
export interface ContentScriptBuilder extends EntrypointBuilder {
    getContext(): ContentScriptContext;
}
