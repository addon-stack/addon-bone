import type {
    ManifestHostPermissions,
    ManifestOptionalPermission,
    ManifestOptionalPermissions,
    ManifestPermission,
    ManifestPermissions,
} from "@typing/manifest";

/**
 * Manifest permissions required by an entrypoint.
 *
 * Browsers grant permissions to the whole extension, never to a single entrypoint.
 * Declaring them here keeps a requirement beside the code that needs it
 * and adds it to the manifest only in builds that include the entrypoint.
 *
 * An entrypoint type opts into this contract explicitly; it is not part of every entrypoint.
 */
export interface PermissionsOptions {
    /**
     * API permissions granted at install time. Written to `permissions`.
     */
    permissions?: ManifestPermission[];

    /**
     * API permissions requested at runtime. Written to `optional_permissions`.
     */
    optionalPermissions?: ManifestOptionalPermission[];

    /**
     * Host match patterns granted at install time.
     * Written to `host_permissions`, or to `permissions` in Manifest V2.
     */
    hostPermissions?: string[];

    /**
     * Host match patterns requested at runtime.
     * Written to `optional_host_permissions`, or to `optional_permissions` in Manifest V2.
     */
    optionalHostPermissions?: string[];
}

/**
 * Permissions collected from the entrypoints that reach a build, ready to be appended to the manifest.
 */
export interface EntrypointPermissions {
    permissions: ManifestPermissions;
    optionalPermissions: ManifestOptionalPermissions;
    hostPermissions: ManifestHostPermissions;
    optionalHostPermissions: ManifestHostPermissions;
}
