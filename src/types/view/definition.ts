import type {
    ViewBuilder,
    ViewConfig,
    ViewContainerCreator,
    ViewContainerFactory,
    ViewContainerOptions,
    ViewContainerTag,
    ViewOptions,
} from "./common";
import type {ViewRenderHandler, ViewRenderValue} from "./render";

/** UI of a view document; entrypoints that also render a view (offscreen, sandbox) adopt it as a mixin. */
export interface ViewRenderDefinition<T extends ViewConfig> {
    render?: ViewRenderValue<T> | ViewRenderHandler<T>;
    container?: ViewContainerTag | ViewContainerOptions | ViewContainerFactory<T>;
}

export interface ViewDefinition<T extends ViewConfig> extends ViewOptions, ViewRenderDefinition<T> {}

export interface ViewResolvedDefinition<T extends ViewConfig> extends ViewDefinition<T> {
    render?: ViewRenderHandler<T>;
    container: ViewContainerCreator<T>;
}

/** A renderer adapter's builder class, selected by the entrypoint filename and injected by the build. */
export type ViewBuilderConstructor<T extends ViewConfig> = new (definition: ViewDefinition<T>) => ViewBuilder;
