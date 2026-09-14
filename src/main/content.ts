import {createAppendMountHandler} from "@entry/content/resolvers/mount";

import {ContentScriptAppendDefinition, ContentScriptDefinition} from "@typing/content";

export * from "@typing/content";

export const defineContentScript = (options: ContentScriptDefinition): ContentScriptDefinition => {
    return options;
};

export const defineContentScriptAppend = (options: ContentScriptAppendDefinition): ContentScriptDefinition => {
    const {append, ...definition} = options;

    return {
        ...definition,
        mount: createAppendMountHandler(append),
    };
};
