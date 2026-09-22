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

        return async props => {
            const value = typeof render === "function" ? await render(props) : render;

            return isDomRenderValue(value) ? value : undefined;
        };
    }

    protected mount(container: Element, value: ViewRenderValue<T>): void {
        if (isDomRenderValue(value)) {
            renderDomValue(container, value);
        }
    }
}
