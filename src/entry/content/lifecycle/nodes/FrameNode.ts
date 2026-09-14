import type {ContentScriptIsolationFrameOptions, ContentScriptNode, ContentScriptStylesRuntime} from "@typing/content";
import {ContentScriptIsolation} from "@typing/content";
import {getPageUrl} from "@main/page";

import {getContentScriptStylesRuntime} from "./isolated-styles";

import {isContentScriptFrameNavigation} from "@shared/content";

/** Owns the child document, but never moves the content script's JavaScript into it. */
export default class FrameNode implements ContentScriptNode {
    private frame?: HTMLIFrameElement;
    private head?: HTMLHeadElement;
    private _target?: Element;
    private runtime?: ContentScriptStylesRuntime;
    private generation = 0;
    private queued = false;

    public constructor(
        private readonly node: ContentScriptNode,
        private readonly options: ContentScriptIsolationFrameOptions = {type: ContentScriptIsolation.Iframe},
        private readonly recover: () => void
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

            frame.style.width = this.size(this.options.width ?? "100%");
            frame.style.height = this.size(this.options.height ?? 150);
            frame.style.border = "0";
            frame.style.display = "block";

            this.frame = frame;

            if (isContentScriptFrameNavigation(this.options)) {
                frame.src = this.options.page !== undefined ? getPageUrl(this.options.page) : this.options.src!;
            } else {
                frame.addEventListener("load", this.onLoad);
            }

            this.container.append(frame);

            created = true;
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

        const target = doc.createElement("div");

        doc.body.append(target);

        this._target = target;
        this.head = doc.head;
        this.runtime = getContentScriptStylesRuntime();
        this.runtime.add(doc.head, null, recovering);

        return true;
    }

    public unmount(): boolean {
        this.generation++;
        this.queued = false;
        this.frame?.removeEventListener("load", this.onLoad);

        this.releaseStyles();

        this.frame = undefined;

        return !!this.node.unmount();
    }

    private releaseStyles(): void {
        if (this.head) {
            this.runtime?.delete(this.head);
        }

        this.head = undefined;
        this.runtime = undefined;
        this._target = undefined;
    }

    private size(value: number | string): string {
        return typeof value === "number" ? `${value}px` : value;
    }
}
