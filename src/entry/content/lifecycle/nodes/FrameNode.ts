import {getPageUrl} from "@main/page";

import type {
    ContentScriptBoundaryCleanup,
    ContentScriptIsolationFrameOptions,
    ContentScriptNode,
    ContentScriptStylesRuntime,
} from "@typing/content";
import {ContentScriptIsolation} from "@typing/content";

import type IsolationSetup from "../IsolationSetup";

import {getContentScriptStylesRuntime} from "./isolated-styles";

import {isContentScriptFrameNavigation} from "@shared/content";

/** Owns the child document but never moves the content script's JavaScript into it. */
export default class FrameNode<Data = unknown> implements ContentScriptNode {
    private frame?: HTMLIFrameElement;
    private head?: HTMLHeadElement;
    private _target?: Element;

    private runtime?: ContentScriptStylesRuntime;

    private generation = 0;
    private queued = false;

    private cleanupBoundary?: ContentScriptBoundaryCleanup;

    private mounting = false;
    private unmounting = false;

    public constructor(
        private readonly node: ContentScriptNode,
        private readonly options: ContentScriptIsolationFrameOptions = {type: ContentScriptIsolation.Iframe},
        private readonly recover: () => void,
        private readonly isolation: IsolationSetup<Data, "iframe">
    ) {}

    public get anchor(): Element {
        return this.node.anchor;
    }

    public get container(): Element | undefined {
        return this.node.container;
    }

    public get target(): Element | undefined {
        return this._target;
    }

    public get boundary(): HTMLIFrameElement | undefined {
        return this.frame;
    }

    public ready(): Promise<void> {
        return this.head && this.runtime ? this.runtime.ready(this.head) : Promise.resolve();
    }

    private readonly onLoad = (): void => {
        if (!this.frame || this.queued || this.intact()) {
            return;
        }

        const generation = this.generation;

        this.queued = true;

        queueMicrotask(() => {
            if (generation !== this.generation) {
                return;
            }

            this.queued = false;

            if (this.container?.isConnected && this.anchor.isConnected) {
                try {
                    this.recover();
                } catch (error) {
                    console.error("Restoring content iframe failed", error);
                }
            }
        });
    };

    private intact(): boolean {
        const doc = this.frame?.contentDocument;

        return !!doc && this._target?.ownerDocument === doc && this._target.isConnected && this.head === doc.head;
    }

    public mount(): boolean {
        if (this.mounting || this.unmounting) {
            return false;
        }

        this.mounting = true;

        try {
            return this.mountNode();
        } finally {
            this.mounting = false;
        }
    }

    private mountNode(): boolean {
        const mounted = !!this.node.mount();

        if (!this.container) {
            return mounted;
        }

        if (!isContentScriptFrameNavigation(this.options) && !this.container.isConnected) {
            throw new Error(
                "Content iframe container is not connected to the document; mount must attach the container before returning"
            );
        }

        let created = false;

        if (!this.frame) {
            const frame = this.container.ownerDocument.createElement("iframe");

            this.frame = frame;
            const generation = this.generation;

            try {
                const cleanup = this.isolation.setup(frame);

                if (generation !== this.generation || this.frame !== frame) {
                    cleanup?.();

                    return false;
                }

                this.cleanupBoundary = cleanup || undefined;

                if (isContentScriptFrameNavigation(this.options)) {
                    frame.src = this.options.page !== undefined ? getPageUrl(this.options.page) : this.options.src!;
                } else {
                    frame.addEventListener("load", this.onLoad);
                }

                this.container.append(frame);

                if (generation !== this.generation || this.frame !== frame) {
                    return false;
                }

                created = true;
            } catch (error) {
                if (generation === this.generation && this.frame === frame) {
                    this.unmount();
                }

                throw error;
            }
        }

        if (isContentScriptFrameNavigation(this.options) || this.intact()) {
            return mounted || created;
        }

        const doc = this.frame.contentDocument;

        if (!doc?.head || !doc.body) {
            throw new Error(
                "Content iframe has no accessible document; only an empty same-origin iframe can render UI"
            );
        }

        const recovering = this.head !== undefined;

        this.releaseStyles();

        const frame = this.frame;
        const generation = this.generation;

        try {
            const target = this.isolation.createTarget(frame, doc);

            if (generation !== this.generation || this.frame !== frame || frame.contentDocument !== doc) {
                return false;
            }

            doc.body.append(target);

            this._target = target;
            this.head = doc.head;
            this.runtime = getContentScriptStylesRuntime();
            this.runtime.add(doc.head, null, recovering);
        } catch (error) {
            if (generation === this.generation && this.frame === frame) {
                this.unmount();
            }

            throw error;
        }

        return true;
    }

    public unmount(): boolean {
        if (this.unmounting) {
            return false;
        }

        this.unmounting = true;
        this.generation++;
        this.queued = false;
        this._target = undefined;

        const cleanup = this.cleanupBoundary;

        this.cleanupBoundary = undefined;

        let removed = false;

        try {
            try {
                cleanup?.();
            } finally {
                try {
                    this.frame?.removeEventListener("load", this.onLoad);
                    this.releaseStyles();
                } finally {
                    this.frame = undefined;
                    removed = !!this.node.unmount();
                }
            }

            return removed;
        } finally {
            this.unmounting = false;
        }
    }

    private releaseStyles(): void {
        const head = this.head;
        const runtime = this.runtime;

        this.head = undefined;
        this.runtime = undefined;
        this._target = undefined;

        if (head) {
            runtime?.delete(head);
        }
    }
}
