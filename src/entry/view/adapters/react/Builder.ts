import {createElement, isValidElement} from "react";
import {createRoot, Root} from "react-dom/client";

import {isDomRenderValue, renderDomValue} from "@entry/core/render";

import ViewBuilder from "../../Builder";

import {ViewConfig, ViewDefinition, ViewRenderHandler, ViewRenderReactComponent, ViewRenderValue} from "@typing/view";

export default class Builder<T extends ViewConfig> extends ViewBuilder<T> {
    protected root?: Root;

    public constructor(definition: ViewDefinition<T>) {
        super(definition);
    }

    protected resolveRender(render?: ViewRenderValue<T> | ViewRenderHandler<T>): ViewRenderHandler<T> | undefined {
        if (render === undefined) {
            return;
        }

        return async props => {
            // Functions in React entrypoints are components; React owns their invocation and hooks.
            const value =
                typeof render === "function" ? createElement(render as ViewRenderReactComponent<T>, props) : render;

            return isValidElement(value) || isDomRenderValue(value) ? value : undefined;
        };
    }

    protected mount(container: Element, value: ViewRenderValue<T>): void {
        if (isValidElement(value)) {
            this.root = createRoot(container);
            this.root.render(value);
        } else if (isDomRenderValue(value)) {
            renderDomValue(container, value);
        }
    }

    protected unmount(): void {
        this.root?.unmount();
        this.root = undefined;
    }
}
