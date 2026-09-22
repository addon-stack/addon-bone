import {createRoot, type Root} from "react-dom/client";

import {isDomRenderValue, renderDomValue} from "@entry/core/render";
import {isReactRenderValue} from "@entry/core/react";

import {RenderNode} from "../../lifecycle/nodes";

import type {ContentScriptRenderValue} from "@typing/content";

export default class Node<Data = unknown> extends RenderNode<Data> {
    private root?: Root;

    protected render(value: ContentScriptRenderValue<Data> | undefined, target: Element): boolean {
        // Text is also iterable, so framework-independent values are checked before React nodes.
        if (isDomRenderValue(value)) {
            renderDomValue(target, value);

            return true;
        }

        if (isReactRenderValue(value)) {
            this.root = createRoot(target);
            this.root.render(value);

            return true;
        }

        return false;
    }

    protected clear(): void {
        const root = this.root;
        this.root = undefined;
        root?.unmount();
    }
}
