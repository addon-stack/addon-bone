import {
    ContentScriptContainerCreator,
    ContentScriptContainerFactory,
    ContentScriptContainerOptions,
    ContentScriptContainerTag,
    ContentScriptProps,
} from "@typing/content";

// prettier-ignore
export const createContainerResolver = (
    container?:
        ContentScriptContainerTag |
        ContentScriptContainerOptions |
        ContentScriptContainerFactory
): ContentScriptContainerCreator =>
    async (props: ContentScriptProps): Promise<Element> => {
        let resolvedContainer = typeof container === "function" ? container(props) : container;

        if (resolvedContainer instanceof Promise) {
            resolvedContainer = await resolvedContainer;
        }

        if (resolvedContainer === undefined || typeof resolvedContainer === "string") {
            resolvedContainer = document.createElement(resolvedContainer || "div");
        } else if (typeof resolvedContainer === "object" && resolvedContainer.constructor === Object) {
            const {tagName = "div", ...options} = resolvedContainer as ContentScriptContainerOptions;

            resolvedContainer = document.createElement(tagName);

            Object.assign(resolvedContainer, options);
        }

        if (!(resolvedContainer instanceof Element)) {
            throw new Error("The content script container must be a valid element");
        }

        return resolvedContainer;
    };
