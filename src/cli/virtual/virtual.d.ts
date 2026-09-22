/** Generated modules import the entrypoint as a namespace and pass it to their runtime resolveDefinition(). */
declare module "virtual:*-entrypoint" {
    const module: {readonly [name: string]: unknown};
    export = module;
}

declare module "virtual:content-builder" {
    export const resolveDefinition: (module: object) => import("@typing/content").ContentScriptDefinition;

    export const Builder:
        | typeof import("@entry/content/adapters/vanilla").Builder
        | typeof import("@entry/content/adapters/react").Builder
        | typeof import("@entry/content").Builder;

    const content:
        | typeof import("@entry/content/adapters/vanilla").default
        | typeof import("@entry/content/adapters/react").default
        | typeof import("@entry/content").default;
    export default content;
}

declare module "virtual:view-builder" {
    export const resolveDefinition: (
        module: object
    ) => import("@typing/view").ViewDefinition<import("@typing/view").ViewConfig>;

    export const Builder:
        | typeof import("@entry/view/adapters/vanilla").Builder
        | typeof import("@entry/view/adapters/react").Builder;

    const view:
        | typeof import("@entry/view/adapters/vanilla").default
        | typeof import("@entry/view/adapters/react").default;
    export default view;
}
