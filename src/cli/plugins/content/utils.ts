import _ from "lodash";

import {ContentScriptConfig, ContentScriptEntrypointOptions, ContentScriptWorld} from "@typing/content";
import {EntrypointType} from "@typing/entrypoint";

export const getContentScriptConfigFromOptions = (options: ContentScriptEntrypointOptions): ContentScriptConfig => {
    const config = _.pick(options, [
        "matches",
        "excludeMatches",
        "includeGlobs",
        "excludeGlobs",
        "allFrames",
        "runAt",
        "world",
        "matchAboutBlank",
        "matchOriginAsFallback",
    ]) as ContentScriptConfig;

    const sort = (arr?: string[]) => arr?.toSorted((a, b) => a.localeCompare(b));

    return {
        ...config,
        matches: sort(config.matches),
        excludeMatches: sort(config.excludeMatches),
        includeGlobs: sort(config.includeGlobs),
        excludeGlobs: sort(config.excludeGlobs),
    };
};

export const getContentChunkName = (world: ContentScriptWorld): string => {
    return `${world === ContentScriptWorld.Main ? "common-main" : "common"}.${EntrypointType.ContentScript}`;
};

export const getContentLayer = (world: ContentScriptWorld): string => {
    return `adnbn:content:${world.toLowerCase()}`;
};
