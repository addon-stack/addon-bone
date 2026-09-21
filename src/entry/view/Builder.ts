import EntrypointBuilder from "@entry/core/Builder";

import {viewContainerResolver} from "./resolvers/container";

import {
    ViewBuilder,
    ViewConfig,
    ViewContainerCreator,
    ViewContainerFactory,
    ViewContainerOptions,
    ViewContainerTag,
    ViewDefinition,
    ViewRenderHandler,
    ViewRenderValue,
    ViewResolvedDefinition,
} from "@typing/view";

/** Owns the view container; renderer adapters only resolve the render and put its value into the container. */
export default abstract class Builder<T extends ViewConfig> extends EntrypointBuilder implements ViewBuilder {
    protected readonly definition: ViewResolvedDefinition<T>;

    private container?: Element;

    protected constructor(definition: ViewDefinition<T>) {
        super();

        this.definition = {
            ...definition,
            container: this.resolveContainer(definition.container),
            render: this.resolveRender(definition.render),
        };
    }

    protected abstract mount(container: Element, value: ViewRenderValue<T>): void;

    protected unmount(): void {
        // Removing the container is enough unless the renderer owns state inside it.
    }

    protected resolveContainer(
        container?: ViewContainerTag | ViewContainerOptions | ViewContainerFactory<T>
    ): ViewContainerCreator<T> {
        return viewContainerResolver<T>(container);
    }

    protected resolveRender(render?: ViewRenderValue<T> | ViewRenderHandler<T>): ViewRenderHandler<T> | undefined {
        if (render === undefined) {
            return;
        }

        throw new Error("View rendering requires a renderer adapter");
    }

    protected getProps(): T {
        const {render, container, ...props} = this.definition;

        return props as T;
    }

    public async build(): Promise<void> {
        await this.destroy();

        const {title, render, container} = this.definition;

        if (title) {
            document.title = title;
        }

        if (!render) {
            return;
        }

        const props = this.getProps();
        const value = await render(props);

        if (value === undefined) {
            return;
        }

        this.container = await container(props);

        // Mount into a connected container: renderers may measure the DOM while mounting.
        document.body.prepend(this.container);

        this.mount(this.container, value);
    }

    public async destroy(): Promise<void> {
        if (!this.container) {
            return;
        }

        try {
            this.unmount();
        } finally {
            this.container.remove();
            this.container = undefined;
        }
    }
}
