import _ from "lodash";

import {ContentScriptConfig, ContentScriptEntrypointOptions} from "@typing/content";

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
