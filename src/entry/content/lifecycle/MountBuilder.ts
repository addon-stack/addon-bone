import Builder from "./Builder";
import IsolationSetup from "./IsolationSetup";
import {FrameNode, MountNode, MarkerNode, ShadowNode, Node} from "./nodes";
import {isContentScriptFrameNavigation} from "@shared/content";

import {
    ContentScriptDefinition,
    ContentScriptIsolation,
    ContentScriptNode,
    ContentScriptProps,
    ContentScriptRenderHandler,
} from "@typing/content";

export default class MountBuilder<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> extends Builder<Data, Isolation> {
    public constructor(definition: ContentScriptDefinition<Data, Isolation>) {
        super(definition);
    }

    protected getProps(node: ContentScriptNode, data: Data): ContentScriptProps<Data> {
        if (!node.container || !node.target) {
            throw new Error("Content script render requires a container and target");
        }

        return {
            ...this.getPrepareProps(node.anchor),
            data,
            container: node.container,
            target: node.target,
            boundary: node.boundary,
        };
    }

    protected async createNode(anchor: Element, data: Data, enabled: boolean): Promise<ContentScriptNode> {
        const navigation = isContentScriptFrameNavigation(this.definition.isolation);
        const render = this.definition.render;

        if (!enabled || (!navigation && (render === undefined || render === true))) {
            return new MarkerNode(new Node(anchor), this.marker);
        }

        const marker = this.marker;
        const container = await this.definition.container({...this.getPrepareProps(anchor), data});

        const mountedNode = new MountNode(new MarkerNode(new Node(anchor, container), marker), this.definition.mount);

        const setup = new IsolationSetup({
            props: () => ({...this.getPrepareProps(anchor), data}),
            container: () => mountedNode.container,
            boundary: this.definition.boundary,
            target: this.definition.target,
        });

        let node: ContentScriptNode = mountedNode;

        switch (this.definition.isolation.type) {
            case ContentScriptIsolation.Shadow:
                node = new ShadowNode(mountedNode, this.definition.isolation, setup);
                break;
            case ContentScriptIsolation.Iframe:
                node = new FrameNode(mountedNode, this.definition.isolation, () => this.context.mount(), setup);
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
