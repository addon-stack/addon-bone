import {isValidElement} from "react";
import {createRoot, type Root} from "react-dom/client";

import {RenderNode} from "../../lifecycle/nodes";

import type {ContentScriptRenderValue} from "@typing/content";

export default class Node<Data = unknown> extends RenderNode<Data> {
    private root?: Root;

    protected render(value: ContentScriptRenderValue<Data> | undefined, target: Element): boolean {
        if (!isValidElement(value)) {
            return false;
        }

        this.root = createRoot(target);
        this.root.render(value);

        return true;
    }

    protected clear(): void {
        const root = this.root;
        this.root = undefined;
        root?.unmount();
    }
}
