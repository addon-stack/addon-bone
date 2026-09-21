import {
    ViewConfig,
    ViewContainerCreator,
    ViewContainerFactory,
    ViewContainerOptions,
    ViewContainerTag,
} from "@typing/view";

export const viewContainerResolver =
    <T extends ViewConfig>(
        container?: ViewContainerTag | ViewContainerOptions | ViewContainerFactory<T>
    ): ViewContainerCreator<T> =>
    async (props: T): Promise<Element> => {
        let resolvedContainer = typeof container === "function" ? container(props) : container;

        if (resolvedContainer instanceof Promise) {
            resolvedContainer = await resolvedContainer;
        }

        if (resolvedContainer === undefined || typeof resolvedContainer === "string") {
            resolvedContainer = document.createElement(resolvedContainer || "div");
        } else if (typeof resolvedContainer === "object" && resolvedContainer.constructor === Object) {
            const {tagName = "div", ...options} = resolvedContainer as ViewContainerOptions;

            resolvedContainer = document.createElement(tagName);

            Object.assign(resolvedContainer, options);
        }

        if (!(resolvedContainer instanceof Element)) {
            throw new Error("The view container must be a valid element");
        }

        return resolvedContainer;
    };
