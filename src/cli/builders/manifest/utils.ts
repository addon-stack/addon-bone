import _ from 'lodash';

import {ManifestAccessibleResource, ManifestMatchSchemes, ManifestSpecialSchemes} from "@typing/manifest";

type ManifestPermissions = chrome.runtime.ManifestPermissions;
type ManifestOptionalPermissions = chrome.runtime.ManifestOptionalPermissions;

type Permission = ManifestPermissions | ManifestOptionalPermissions;
/**
 * Filters and adapts permissions for Manifest V2 compatibility.
 *
 * @param permissions - Set of permissions to filter
 * @returns New set of permissions adapted for Manifest V2
 */
export const filterPermissionsForMV2 = <T extends Permission>(permissions: Set<T>): Set<T> => {
    const filteredPermissions = new Set(permissions);

    /**
     * Manifest V3 introduced a new 'scripting' permission for working with the Chrome Scripting API,
     * but Manifest V2 uses the 'tabs' permission for executing scripts on web pages.
     * This function automatically replaces 'scripting' with 'tabs' to ensure backward compatibility.
     *
     * @example
     * ```typescript
     * const mv3Permissions = new Set(['scripting', 'storage', 'activeTab']);
     * const mv2Permissions = filterPermissionsForMV2(mv3Permissions);
     * // Result: Set(['tabs', 'storage', 'activeTab'])
     * ```
     */
    if (filteredPermissions.has("scripting" as T)) {
        filteredPermissions.delete("scripting" as T);
        filteredPermissions.add("tabs" as T);
    }

    filteredPermissions.delete("offscreen" as T);

    return filteredPermissions;
};

export const filterPermissionsForMV3 = <T extends Permission>(permissions: Set<T>): Set<T> => {
    const filteredPermissions = new Set(permissions);

    /**
     * @permissions webRequestBlocking, webAuthenticationProxy, webRequestAuthProvider
     * @description These permissions were removed in Manifest V3 due to concerns related to security, performance, and transparency.
     * - `webRequestBlocking`: Allowed real-time interception and modification of network requests, which introduced latency and potential security risks. Replaced by the safer, declarative `declarativeNetRequest` API.
     * - `webAuthenticationProxy`: Provided proxy authentication control, but was rarely used and posed privacy risks.
     * - `webRequestAuthProvider`: Enabled handling of HTTP authentication (onAuthRequired), but was considered unsafe in the new MV3 architecture due to its ability to interfere with authentication flows.
     * @manifestV3 Removed. These APIs are no longer available in extensions using Manifest V3.
     */
    filteredPermissions.delete("webAuthenticationProxy" as T);
    filteredPermissions.delete("webRequestAuthProvider" as T);
    filteredPermissions.delete("webRequestBlocking" as T);

    return filteredPermissions;
};

export const filterHostPatterns = (patterns: Set<string>): Set<string> => {
    if (patterns.has("<all_urls>")) {
        return new Set(["<all_urls>"]);
    }

    const result = new Set<string>();

    const activeWildcards = new Set<string>();

    if (patterns.has("*://*/*")) {
        activeWildcards.add("*://*/*");
        result.add("*://*/*");
    }

    for (const scheme of ManifestMatchSchemes) {
        const wildcard = `${scheme}://*/*`;

        if (patterns.has(wildcard)) {
            if (scheme === "http" || scheme === "https") {
                if (!activeWildcards.has("*://*/*")) {
                    activeWildcards.add(wildcard);
                    result.add(wildcard);
                }
            } else {
                activeWildcards.add(wildcard);
                result.add(wildcard);
            }
        }
    }

    const isCoveredByWildcard = (pattern: string): boolean => {
        const schemeIndex = pattern.indexOf("://");
        if (schemeIndex === -1) return false;

        const scheme = pattern.substring(0, schemeIndex);

        if (ManifestSpecialSchemes.has(scheme)) {
            return false;
        }

        if (activeWildcards.has("*://*/*") && (scheme === "http" || scheme === "https")) {
            return true;
        }

        return activeWildcards.has(`${scheme}://*/*`);
    };

    for (const pattern of patterns) {
        if (activeWildcards.has(pattern)) {
            continue;
        }

        if (!isCoveredByWildcard(pattern)) {
            result.add(pattern);
        }
    }

    return result;
};

export const mergeWebAccessibleResources = (resources: ManifestAccessibleResource[]): ManifestAccessibleResource[] => {
    if (resources.length === 0) return [];

    // Normalize all resources by applying host pattern filtering to remove redundant or overlapping patterns
    const simplifiedMatches = resources.map(({resources, matches}) => ({
        resources,
        matches: Array.from(filterHostPatterns(new Set(matches))),
    }));

    // Create a Map to group resources by identical sets of host patterns (matches)
    const combinedResources = new Map<string[], string[]>();

    simplifiedMatches.forEach(({matches, resources}) => {
        for (const [matches_, resources_] of combinedResources) {
            if (_.isEqual(matches_, matches)) {
                combinedResources.set(matches_, [...resources_, ...resources]);
                return;
            }
        }
        combinedResources.set(matches, resources);
    });

    // Handle global patterns ("<all_urls>" and "*://*/*") - remove their resources from other entries
    let entries = Array.from(combinedResources.entries());

    entries.forEach(([matches, resources]) => {
        if (matches.includes("<all_urls>") || matches.includes("*://*/*")) {
            for (const [matches_, resources_] of combinedResources) {
                if (!_.isEqual(matches, matches_)) {
                    combinedResources.set(matches_, _.difference(resources_, resources));
                }
            }
        }
    });

    // Handle scheme-specific wildcard patterns (e.g., "https://*/*", "http://*/*")
    // Remove resources from entries that have more specific patterns of the same scheme
    entries = Array.from(combinedResources.entries());

    entries.forEach(([matches, resources]) => {
        for (const scheme of ManifestMatchSchemes) {
            if (matches.includes(`${scheme}://*/*`)) {
                for (const [matches_, resources_] of combinedResources) {
                    if (!_.isEqual(matches, matches_)) {
                        if (matches_.some(match_ => match_.includes(`${scheme}://`))) {
                            combinedResources.set(matches_, _.difference(resources_, resources));
                        }
                    }
                }
            }
        }
    });

    // Remove duplicates in resource arrays and filter out entries with empty resource arrays
    return Array.from(combinedResources)
        .map(([matches, resources]) => ({matches, resources: Array.from(new Set(resources))}))
        .filter(({resources}) => resources.length > 0);
};
