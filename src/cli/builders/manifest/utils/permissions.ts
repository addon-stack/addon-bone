import _ from "lodash";

type ManifestPermissions = chrome.runtime.ManifestPermission;
type ManifestOptionalPermissions = chrome.runtime.ManifestOptionalPermission;

type Permission = ManifestPermissions | ManifestOptionalPermissions;
/**
 * Filters and adapts permissions for Manifest V2 compatibility.
 *
 * @param permissions - Set of permissions to filter
 * @returns New set of permissions adapted for Manifest V2
 */
export const filterPermissions = <T extends Permission>(permissions: Set<T>): Set<T> => {
    if (permissions.has("tabs" as T)) {
        permissions.delete("activeTab" as T);
    }

    return permissions;
};

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

    return filterPermissions(filteredPermissions);
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

    return filterPermissions(filteredPermissions);
};

export const filterOptionalPermissions = <O extends ManifestOptionalPermissions, R extends ManifestPermissions>(
    optional: Set<O>,
    required: Set<R>
): O[] => {
    const allPermissions = filterPermissions(new Set([...optional, ...required]));

    return _.difference(Array.from(allPermissions), Array.from(required)) as O[];
};
