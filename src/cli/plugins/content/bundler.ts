import type {ResourceAccessPluginRequirement} from "@cli/bundler/plugins/resource-access";
import type {IsolatedStylesPluginFiles} from "@cli/bundler/plugins/isolated-styles";
import {isContentScriptFrameNavigation} from "@shared/content";
import {hasIsolatedTarget} from "./utils";

import {ContentScriptMatches, ContentScriptWorld, type ContentScriptEntrypointOptions} from "@typing/content";
import {EntrypointType} from "@typing/entrypoint";

/** Reject unavailable destinations and warn about likely missing query flags without changing CSS routing. */
export const validateContentStyles = (
    entry: string,
    options: ContentScriptEntrypointOptions | undefined,
    files: IsolatedStylesPluginFiles
): readonly string[] => {
    if (!options) return [];
    if (files.isolated.length > 0 && isContentScriptFrameNavigation(options.isolation)) {
        throw new Error(
            `Entrypoint "${entry}" uses ?isolation CSS with isolation.page/isolation.src, but has no local render target. Import these styles in the embedded page instead.`
        );
    }
    if (hasIsolatedTarget(options) && files.document.length > 0 && files.isolated.length === 0) {
        return [
            `[adnbn:missing-isolation-css] Entrypoint "${entry}" uses isolation: "${options.isolation?.type}", but has no CSS marked with ?isolation. Imported CSS will be delivered to the page document. If these styles belong to the isolated UI, import them with ?isolation. Document-only styles are valid; this warning can be suppressed with bundler ignoreWarnings.`,
        ];
    }
    return [];
};

export const createPageAccessRequirements = (
    entries: ReadonlyMap<string, ContentScriptEntrypointOptions>,
    pages: ReadonlyMap<string, string>
): ResourceAccessPluginRequirement[] => {
    const requirements: ResourceAccessPluginRequirement[] = [];

    for (const [entry, options] of entries) {
        const alias = options.isolation?.page;
        if (alias === undefined) continue;

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
