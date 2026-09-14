import Builder from "./Builder";
import {FrameNode, MountNode, MarkerNode, ShadowNode, Node} from "./nodes";
import {isContentScriptFrameNavigation} from "@shared/content";

import {
    ContentScriptDefinition,
    ContentScriptIsolation,
    ContentScriptNode,
    ContentScriptProps,
    ContentScriptRenderHandler,
} from "@typing/content";

export default class MountBuilder<Data = unknown> extends Builder<Data> {
    public constructor(definition: ContentScriptDefinition<Data>) {
        super(definition);
    }

    protected getProps(node: ContentScriptNode, data: Data): ContentScriptProps<Data> {
        if (!node.container || !node.target) {
            throw new Error("Content script render requires a container and target");
        }

        return {...this.getPrepareProps(node.anchor), data, container: node.container, target: node.target};
    }

    protected async createNode(anchor: Element, data: Data, enabled: boolean): Promise<ContentScriptNode> {
        const navigation = isContentScriptFrameNavigation(this.definition.isolation);
        const render = this.definition.render;

        if (!enabled || (!navigation && (render === undefined || render === true))) {
            return new MarkerNode(new Node(anchor), this.marker);
        }

        const marker = this.marker;
        const container = await this.definition.container({...this.getPrepareProps(anchor), data});

        let node: ContentScriptNode = new MountNode(
            new MarkerNode(new Node(anchor, container), marker),
            this.definition.mount
        );

        switch (this.definition.isolation.type) {
            case ContentScriptIsolation.Shadow:
                node = new ShadowNode(node, this.definition.isolation);
                break;
            case ContentScriptIsolation.Iframe:
                node = new FrameNode(node, this.definition.isolation, () => this.context.mount());
                break;
        }

        return navigation || typeof render !== "function"
            ? node
            : this.createRenderer(node, render, () => this.getProps(node, data));
    }

    protected createRenderer(
        node: ContentScriptNode,
        render: ContentScriptRenderHandler<Data>,
        props: () => ContentScriptProps<Data>
    ): ContentScriptNode {
        throw new Error("Content script rendering requires a renderer adapter");
    }
}
