import Builder from "./Builder";
import Node from "./Node";
import MountNode from "./MountNode";
import MarkerNode from "./MarkerNode";

import {ContentScriptNode, ContentScriptProps, ContentScriptRenderValue} from "@typing/content";

export default abstract class extends Builder {
    private values = new Map<Element, null | ContentScriptRenderValue>();

    protected getProps(anchor: Element): ContentScriptProps {
        const {anchor: _, mount, watch, render, container, main, ...options} = this.definition;

        return {...options, anchor};
    }

    protected async getValue(anchor: Element): Promise<undefined | ContentScriptRenderValue> {
        if (!this.values.has(anchor)) {
            const value = await this.renderValue(anchor);

            this.values.set(anchor, value === undefined ? undefined : value);
        }

        return this.values.get(anchor);
    }

    protected async renderValue(anchor: Element): Promise<undefined | ContentScriptRenderValue> {
        const {render} = this.definition;

        if (render === undefined) {
            return;
        }

        return render(this.getProps(anchor));
    }

    protected async createNode(anchor: Element): Promise<ContentScriptNode> {
        let container: Element | undefined;

        const value = await this.getValue(anchor);

        if (typeof value !== "boolean" && value !== undefined) {
            container = (await this.definition.container(this.getProps(anchor))) as Element | undefined;
        }

        return new MountNode(new MarkerNode(new Node(anchor, container), this.marker), this.definition.mount);
    }

    protected cleanupNode(anchor: Element): void {
        this.values.delete(anchor);
    }
}
