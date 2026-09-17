import type {ResourceAccessPluginRequirement} from "@cli/bundler/plugins/resource-access";

import {ContentScriptMatches, ContentScriptWorld, type ContentScriptEntrypointOptions} from "@typing/content";
import {EntrypointType} from "@typing/entrypoint";

export const createPageAccessRequirements = (
    entries: ReadonlyMap<string, ContentScriptEntrypointOptions>,
    pages: ReadonlyMap<string, string>
): ResourceAccessPluginRequirement[] => {
    const requirements: ResourceAccessPluginRequirement[] = [];

    for (const [entry, options] of entries) {
        const alias = options.isolation?.page;

        if (alias === undefined) {
            continue;
        }

        const resource = pages.get(alias);

        if (!resource) {
            throw new Error(`Content entrypoint "${entry}" references unknown page "${alias}"`);
        }

        requirements.push({
            resource,
            matches: options.matches ?? ContentScriptMatches,
            issuer: `Content entrypoint "${entry}" embedding page "${alias}"`,
            hint: "add matches to the page or narrow the content matches",
        });
    }

    return requirements;
};

export const getContentChunkName = (world: ContentScriptWorld): string => {
    return `${world === ContentScriptWorld.Main ? "common-main" : "common"}.${EntrypointType.ContentScript}`;
};
