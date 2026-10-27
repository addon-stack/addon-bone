import {isDomRenderValue, renderDomValue} from "@entry/core/render";

import ViewBuilder from "../../Builder";

import {ViewConfig, ViewDefinition, ViewRenderHandler, ViewRenderValue} from "@typing/view";

export default class Builder<T extends ViewConfig> extends ViewBuilder<T> {
    public constructor(definition: ViewDefinition<T>) {
        super(definition);
    }

    protected resolveRender(render?: ViewRenderValue<T> | ViewRenderHandler<T>): ViewRenderHandler<T> | undefined {
        if (render === undefined) {
            return;
        }

        return props => {
            const value = typeof render === "function" ? render(props) : render;

            if (
                value !== null &&
                (typeof value === "object" || typeof value === "function") &&
                "then" in value &&
                typeof value.then === "function"
            ) {
                console.warn(
                    "Vanilla view render must be synchronous. The Promise or thenable result was ignored. " +
                        "Load data in a separate async function and return the initial UI immediately."
                );

                return;
            }

            return isDomRenderValue(value) ? value : undefined;
        };
    }

    protected mount(container: Element, value: ViewRenderValue<T>): void {
        if (isDomRenderValue(value)) {
            renderDomValue(container, value);
        }
    }
}
