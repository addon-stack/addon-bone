import {RenderNode} from "../../lifecycle/nodes";
import type {ContentScriptRenderValue} from "@typing/content";

export default class Node<Data = unknown> extends RenderNode<Data> {
    protected render(value: ContentScriptRenderValue<Data> | undefined, target: Element): boolean {
        if (value && typeof value === "object" && "nodeType" in value && value.nodeType === 1) {
            target.appendChild(value as Element);
        } else if (typeof value === "string" || typeof value === "number") {
            target.textContent = String(value);
        } else {
            return false;
        }

        return true;
    }

    protected clear(): void {}
}
