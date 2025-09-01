import _ from "lodash";

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

    const simplifiedMatches: ManifestAccessibleResource[] = resources.map(r => {
        const {resources, matches, extensionIds, useDynamicUrl} = r;
        return {
            resources,
            extensionIds,
            useDynamicUrl,
            matches: matches ? Array.from(filterHostPatterns(new Set(matches))) : matches,
        };
    });

    const normalize = (arr?: string[]) => Array.from(new Set(arr || [])).sort();

    const makeKey = (r: ManifestAccessibleResource, exclude: (keyof ManifestAccessibleResource)[]): string => {
        const obj: ManifestAccessibleResource = {
            resources: normalize(r.resources),
            matches: normalize(r.matches),
            extensionIds: normalize(r.extensionIds),
            useDynamicUrl: r.useDynamicUrl,
        };

        for (const field of exclude) {
            delete obj[field];
        }

        return JSON.stringify(obj);
    };

    const mergeTwo = (a: ManifestAccessibleResource, b: ManifestAccessibleResource): ManifestAccessibleResource => ({
        resources: normalize([...a.resources, ...b.resources]),
        matches: normalize([...(a.matches || []), ...(b.matches || [])]),
        extensionIds: normalize([...(a.extensionIds || []), ...(b.extensionIds || [])]),
        useDynamicUrl: a.useDynamicUrl,
    });

    const merge = (resources: ManifestAccessibleResource[], mergeBy: keyof ManifestAccessibleResource) => {
        const map = new Map<string, ManifestAccessibleResource>();
        let changed = false;
        for (const r of resources) {
            const key = makeKey(r, [mergeBy]);
            if (map.has(key)) {
                const merged = mergeTwo(map.get(key)!, r);
                map.set(key, merged);
                changed = true;
            } else {
                map.set(key, r);
            }
        }

        return {
            changed,
            result: Array.from(map.values()),
        };
    };

    let changed = true;

    let result: ManifestAccessibleResource[] = simplifiedMatches.map(r => ({
        resources: normalize(r.resources),
        matches: normalize(r.matches),
        extensionIds: normalize(r.extensionIds),
        useDynamicUrl: r.useDynamicUrl,
    }));

    while (changed) {
        changed = false;

        const mergeByResources = merge(result, "resources");
        changed = mergeByResources.changed;
        result = mergeByResources.result;

        const mergeByMatches = merge(result, "matches");
        changed = mergeByMatches.changed;
        result = mergeByMatches.result;

        const mergeByExtensionIds = merge(result, "extensionIds");
        changed = mergeByExtensionIds.changed;
        result = mergeByExtensionIds.result;
    }

    for (const entry of result) {
        if (!entry.matches) continue;
        if (entry.matches.includes("<all_urls>") || entry.matches.includes("*://*/*")) {
            for (const other of result) {
                if (other === entry) continue;
                // збігаються усі крім resources → можна чистити resources
                if (
                    _.isEqual(other.matches, entry.matches) ||
                    other.useDynamicUrl !== entry.useDynamicUrl ||
                    !_.isEqual(other.extensionIds, entry.extensionIds)
                ) {
                    continue;
                }
                other.resources = other.resources.filter(r => !entry.resources.includes(r));
            }
        }
    }

    for (const entry of result) {
        if (!entry.matches) continue;
        for (const scheme of ManifestMatchSchemes) {
            if (entry.matches.includes(`${scheme}://*/*`)) {
                for (const other of result) {
                    if (other === entry) continue;
                    if (
                        other.useDynamicUrl !== entry.useDynamicUrl ||
                        !_.isEqual(other.extensionIds, entry.extensionIds)
                    ) {
                        continue;
                    }
                    if (other.matches?.some(m => m.startsWith(`${scheme}://`))) {
                        other.resources = other.resources.filter(r => !entry.resources.includes(r));
                    }
                }
            }
        }
    }

    result = result
        .filter(r => r.resources.length > 0)
        .map(r => {
            if (r.matches?.length === 0) delete r.matches;
            if (r.extensionIds?.length === 0) delete r.extensionIds;
            if (r.useDynamicUrl === undefined) delete r.useDynamicUrl;
            return r;
        });

    return result;
};
