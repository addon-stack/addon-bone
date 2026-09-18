import type {EntrypointPermissions, PermissionsOptions} from "@typing/permissions";

/**
 * Unites the permissions declared by entrypoints that reach the build.
 * Pass only the options of those entrypoints: candidates that lost the selection must not contribute.
 */
export const collectPermissions = (options: Iterable<PermissionsOptions>): EntrypointPermissions => {
    const collected: EntrypointPermissions = {
        permissions: new Set(),
        optionalPermissions: new Set(),
        hostPermissions: new Set(),
        optionalHostPermissions: new Set(),
    };

    for (const {permissions, optionalPermissions, hostPermissions, optionalHostPermissions} of options) {
        permissions?.forEach(permission => collected.permissions.add(permission));
        optionalPermissions?.forEach(permission => collected.optionalPermissions.add(permission));
        hostPermissions?.forEach(permission => collected.hostPermissions.add(permission));
        optionalHostPermissions?.forEach(permission => collected.optionalHostPermissions.add(permission));
    }

    return collected;
};
