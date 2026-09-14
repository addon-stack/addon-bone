import {createAppendMountHandler} from "@entry/content/resolvers/mount";

import {ContentScriptAppendDefinition, ContentScriptDefinition} from "@typing/content";

export * from "@typing/content";

export const defineContentScript = <Data = undefined>(
    options: ContentScriptDefinition<Data>
): ContentScriptDefinition<Data> => {
    return options;
};

export const defineContentScriptAppend = <Data = undefined>(
    options: ContentScriptAppendDefinition<Data>
): ContentScriptDefinition<Data> => {
    const {append, ...definition} = options;

    return {
        ...definition,
        mount: createAppendMountHandler(append),
    };
};
