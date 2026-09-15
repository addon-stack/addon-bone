import {createAppendMountHandler} from "@entry/content/resolvers/mount";

import {ContentScriptAppendDefinition, ContentScriptDefinition, ContentScriptIsolation} from "@typing/content";

export * from "@typing/content";

export const defineContentScript = <Data = undefined, const Isolation extends `${ContentScriptIsolation}` = "none">(
    options: ContentScriptDefinition<Data, Isolation>
): ContentScriptDefinition<Data, Isolation> => {
    return options;
};

export const defineContentScriptAppend = <
    Data = undefined,
    const Isolation extends `${ContentScriptIsolation}` = "none",
>(
    options: ContentScriptAppendDefinition<Data, Isolation>
): ContentScriptDefinition<Data, Isolation> => {
    const {append, ...definition} = options;

    return {
        ...definition,
        mount: createAppendMountHandler(append),
    } as ContentScriptDefinition<Data, Isolation>;
};
