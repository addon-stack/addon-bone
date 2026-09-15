import type {ContentScriptContainerProps, ContentScriptIsolation} from "./common";

export interface ContentScriptBoundaryMap {
    none: undefined;
    shadow: ShadowRoot;
    iframe: HTMLIFrameElement;
}

/** The browser node implementing isolation, distinct from the container and render target. */
export type ContentScriptBoundary<Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`> =
    ContentScriptBoundaryMap[Isolation];

/** Available when isolation is created, before its target or child document is ready. */
export interface ContentScriptBoundaryProps<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> extends ContentScriptContainerProps<Data> {
    container: Element;
    boundary: Exclude<ContentScriptBoundary<Isolation>, undefined>;
}

/** Releases user subscriptions before the boundary is removed. */
export type ContentScriptBoundaryCleanup = () => void;

/** Synchronous setup, once per boundary; return cleanup for subscriptions or observers. */
export type ContentScriptBoundaryHandler<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = (props: ContentScriptBoundaryProps<Data, Isolation>) => void | ContentScriptBoundaryCleanup;
