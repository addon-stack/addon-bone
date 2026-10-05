import type {Optional} from "utility-types";
import type {HtmlEntrypointOptions} from "@typing/html";

import {Awaiter, PickNonFunctionProperties} from "@typing/helpers";
import {EntrypointBuilder, EntrypointOptions} from "@typing/entrypoint";

export interface ViewConfig {
    as?: string;
    title?: string;
    template?: string;
}

export type ViewOptions = ViewConfig & EntrypointOptions & HtmlEntrypointOptions;

export type ViewEntrypointOptions = ViewOptions;

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

// Builder
export type ViewBuilder = EntrypointBuilder;
