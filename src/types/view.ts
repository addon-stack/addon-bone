import type {FC, ReactNode} from "react";
import type {Optional} from "utility-types";
import type {HtmlTagsPluginOptions as HtmlOptions} from "@rspackjs/plugin-html-tags";

import {Awaiter, ExcludeFunctionsFromProperties, PickNonFunctionProperties} from "@typing/helpers";
import {EntrypointBuilder, EntrypointOptions} from "@typing/entrypoint";

export interface ViewConfig {
    as?: string;
    title?: string;
    template?: string;
}

export type ViewOptions = ViewConfig & EntrypointOptions & ExcludeFunctionsFromProperties<HtmlOptions>;

export type ViewEntrypointOptions = ViewOptions;

// Render
export type ViewRenderReactComponent<T extends ViewConfig> = FC<T>;
export type ViewRenderValue<T extends ViewConfig> = string | Element | ReactNode | ViewRenderReactComponent<T>;
export type ViewRenderHandler<T extends ViewConfig> = (props: T) => Awaiter<void | ViewRenderValue<T>>;

// Container
export type ViewContainerTag = Exclude<keyof HTMLElementTagNameMap, "html" | "body">;

export type ViewContainerOptions = {
    [Tag in ViewContainerTag]: {tagName: Tag} & Exclude<
        Optional<PickNonFunctionProperties<HTMLElementTagNameMap[Tag]>>,
        "id"
    >;
}[ViewContainerTag];

export type ViewContainerFactory<T extends ViewConfig> = (
    props: T
) => Awaiter<Element | ViewContainerTag | ViewContainerOptions>;
export type ViewContainerCreator<T extends ViewConfig> = (props: T) => Awaiter<Element>;

// Definition
export interface ViewDefinition<T extends ViewConfig> extends ViewOptions {
    render?: ViewRenderValue<T> | ViewRenderHandler<T>;
    container?: ViewContainerTag | ViewContainerOptions | ViewContainerFactory<T>;
}

export interface ViewResolvedDefinition<T extends ViewConfig> extends ViewDefinition<T> {
    render: ViewRenderHandler<T>;
    container: ViewContainerCreator<T>;
}

// Builder
export type ViewBuilder = EntrypointBuilder;
