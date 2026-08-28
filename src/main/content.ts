import {
    contentScriptMountAppendResolver,
    contentScriptAnchorResolver,
    contentScriptAwaitFirstResolver,
    contentScriptMutationObserverResolver,
    contentScriptRenderResolver,
    contentScriptContainerResolver,
} from "@entry/content/core/resolvers";

import {ContentScriptAppendDefinition, ContentScriptDefinition} from "@typing/content";

export {
    contentScriptMountAppendResolver,
    contentScriptAnchorResolver,
    contentScriptAwaitFirstResolver,
    contentScriptMutationObserverResolver,
    contentScriptRenderResolver,
    contentScriptContainerResolver,
};

export * from "@typing/content";

export const defineContentScript = (options: ContentScriptDefinition): ContentScriptDefinition => {
    return options;
};

export const defineContentScriptAppend = (options: ContentScriptAppendDefinition): ContentScriptDefinition => {
    const {append, ...definition} = options;

    return {
        ...definition,
        mount: contentScriptMountAppendResolver(append),
    };
};
