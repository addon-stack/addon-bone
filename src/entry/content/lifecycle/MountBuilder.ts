import Builder from "./Builder";
import IsolationSetup from "./IsolationSetup";
import {FrameNode, MountNode, MarkerNode, ShadowNode, Node} from "./nodes";

import {isContentScriptFrameNavigation} from "@shared/content";

import type {
    ContentScriptIsolationAssembly,
    ContentScriptNodeAssembly,
    ContentScriptRenderLifecycle,
    ContentScriptRenderOptions,
} from "./types";

import {
    ContentScriptDefinition,
    ContentScriptIsolation,
    ContentScriptNode,
    ContentScriptPrepareResult,
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

    protected async createNode(
        anchor: Element,
        result: ContentScriptPrepareResult<Data> | undefined
    ): Promise<ContentScriptNodeAssembly> {
        const navigation = isContentScriptFrameNavigation(this.definition.isolation);
        const render = this.definition.render;

        if (result === false || (!navigation && (render === undefined || render === true))) {
            return {node: new MarkerNode(new Node(anchor), this.marker)};
        }

        const data = result as Data;
        const mountedNode = await this.createMountNode(anchor, data);
        const {node, ready} = this.createIsolation(mountedNode, data);

        if (navigation || typeof render !== "function") {
            return {node};
        }

        const renderer = this.createRenderer(node, render, () => this.getProps(node, data), {ready});

        return {node: renderer, renderer};
    }

    protected async createMountNode(anchor: Element, data: Data): Promise<ContentScriptNode> {
        const marker = this.marker;
        const container = await this.definition.container({...this.getPrepareProps(anchor), data});

        return new MountNode(
            new MarkerNode(new Node(anchor, container), marker),
            this.context.containers,
            this.definition.mount
        );
    }

    protected createIsolation(node: ContentScriptNode, data: Data): ContentScriptIsolationAssembly {
        const options = this.definition.isolation;

        if (options.type === ContentScriptIsolation.None) {
            return {node};
        }

        const setup = new IsolationSetup({
            props: () => ({...this.getPrepareProps(node.anchor), data}),
            container: () => node.container,
            boundary: this.definition.boundary,
            target: this.definition.target,
        });

        if (options.type === ContentScriptIsolation.Shadow) {
            const shadow = new ShadowNode(node, options, setup);

            return {node: shadow, ready: () => shadow.ready()};
        }

        const frame = new FrameNode(node, options, () => this.context.mount(), setup);

        return {node: frame, ready: () => frame.ready()};
    }

    protected createRenderer(
        node: ContentScriptNode,
        render: ContentScriptRenderHandler<Data>,
        props: () => ContentScriptProps<Data>,
        options: ContentScriptRenderOptions
    ): ContentScriptNode & ContentScriptRenderLifecycle {
        throw new Error("Content script rendering requires a renderer adapter");
    }
}
