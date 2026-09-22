import {isDomRenderValue, renderDomValue} from "@entry/core/render";

import {RenderNode} from "../../lifecycle/nodes";
import type {ContentScriptRenderValue} from "@typing/content";

export default class Node<Data = unknown> extends RenderNode<Data> {
    protected render(value: ContentScriptRenderValue<Data> | undefined, target: Element): boolean {
        if (!isDomRenderValue(value)) {
            return false;
        }

        renderDomValue(target, value);

        return true;
    }

    protected clear(): void {}
}
