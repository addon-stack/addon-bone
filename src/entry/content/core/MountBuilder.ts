import Builder from "./Builder";

import {FrameNode, MountNode, MarkerNode, ShadowNode, Node} from "./nodes";

import {isContentScriptFrameNavigation} from "@shared/content";

import {ContentScriptIsolation, ContentScriptNode, ContentScriptProps, ContentScriptRenderValue} from "@typing/content";

export default abstract class extends Builder {
    private values = new Map<Element, null | ContentScriptRenderValue>();

    protected getProps(anchor: Element): ContentScriptProps {
        const {anchor: _, mount, watch, render, container, main, isolation, ...options} = this.definition;

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

        if (
            isContentScriptFrameNavigation(this.definition.isolation) ||
            (typeof value !== "boolean" && value !== undefined)
        ) {
            container = (await this.definition.container(this.getProps(anchor))) as Element | undefined;
        }

        const node = new MountNode(new MarkerNode(new Node(anchor, container), this.marker), this.definition.mount);

        switch (this.definition.isolation.type) {
            case ContentScriptIsolation.Shadow:
                return new ShadowNode(node, this.definition.isolation);
            case ContentScriptIsolation.Iframe:
                return new FrameNode(node, this.definition.isolation, () => this.context.mount());
            default:
                return node;
        }
    }

    protected cleanupNode(anchor: Element): void {
        this.values.delete(anchor);
    }
}
