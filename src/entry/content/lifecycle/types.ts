import type {ContentScriptNode} from "@typing/content";

/** One completion callback for the event decorator paired with this renderer. */
export interface ContentScriptMountNotifier {
    setMountHandler(handler: () => void): void;
}

export interface ContentScriptRenderLifecycle extends ContentScriptMountNotifier {
    /** The owning lifecycle handles deferred renderer failures without throwing. */
    setErrorHandler(handler: (error: unknown) => void): void;
}

/** Internal composition result; only renderers supply their own completion signal. */
export interface ContentScriptNodeAssembly {
    node: ContentScriptNode;
    renderer?: ContentScriptRenderLifecycle;
}

export interface ContentScriptRenderOptions {
    ready?: () => Promise<void>;
}

/** The isolation stage supplies a node and optional readiness for its render target. */
export interface ContentScriptIsolationAssembly {
    node: ContentScriptNode;
    ready?: () => Promise<void>;
}
