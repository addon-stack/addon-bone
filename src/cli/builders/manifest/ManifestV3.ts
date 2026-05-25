import ManifestBase, {ManifestError} from "./ManifestBase";

import {filterHostPatterns, filterOptionalPermissions, filterPermissionsForMV3} from "./utils";

import {CoreManifest, ManifestAccessibleResource, ManifestVersion} from "@typing/manifest";
import {Browser} from "@typing/browser";

type ManifestV3 = chrome.runtime.ManifestV3;

export default class extends ManifestBase<ManifestV3> {
    public constructor(browser: Browser) {
        super(browser);
    }

    public getManifestVersion(): ManifestVersion {
        return 3;
    }

    protected buildBackground(): Partial<CoreManifest> | undefined {
        if (this.browser === Browser.Firefox) {
            const manifest = super.buildBackground();

            if (manifest) {
                const {background, ...other} = manifest;

                return {...other, background: {...background, persistent: undefined}};
            }

            return;
        }

        if (this.background) {
            const {entry} = this.background;

            const dependencies = this.dependencies.get(entry);

            if (!dependencies) {
                throw new ManifestError(`Background entry "${entry}" not found in dependencies`);
            }

            if (dependencies.js.size === 0) {
                throw new ManifestError(`Background entry "${entry}" has no dependencies`);
            }

            if (dependencies.js.size > 1) {
                throw new ManifestError(`Background entry "${entry}" has more than one dependency`);
            }

            const [js] = Array.from(dependencies.js);

            return {background: {service_worker: js}};
        }
    }

    protected buildAction(): Partial<ManifestV3> | undefined {
        if (this.popup) {
            const {path, icon, title} = this.popup;

            return {
                action: {
                    default_title: title || this.name,
                    default_popup: path,
                    default_icon: this.getIconsByName(icon),
                },
            };
        } else if (this.hasExecuteActionCommand()) {
            return {
                action: {
                    default_title: this.name,
                },
            };
        }
    }

    protected buildPermissions(): Partial<ManifestV3> | undefined {
        const permissions = Array.from(filterPermissionsForMV3(this.combinedPermissions));

        if (permissions.length > 0) {
            return {permissions};
        }
    }

    protected buildOptionalPermissions(): Partial<ManifestV3> | undefined {
        const optionalPermissions = filterOptionalPermissions(
            filterPermissionsForMV3(this.combinedOptionalPermissions),
            filterPermissionsForMV3(this.combinedPermissions)
        );

        if (optionalPermissions.length > 0) {
            return {optional_permissions: optionalPermissions};
        }
    }

    protected buildHostPermissions(): Partial<ManifestV3> | undefined {
        if (this.combinedHostPermissions.size > 0) {
            return {host_permissions: [...filterHostPatterns(this.combinedHostPermissions)]};
        }
    }

    protected buildOptionalHostPermissions(): Partial<ManifestV3> | undefined {
        // prettier-ignore
        const optionalHostPermissions = Array
            .from(filterHostPatterns(new Set([...this.combinedHostPermissions, ...this.combinedOptionalHostPermissions])))
            .filter((permission) => !this.combinedHostPermissions.has(permission));

        if (optionalHostPermissions.length > 0) {
            return {optional_host_permissions: optionalHostPermissions};
        }
    }

    protected buildWebAccessibleResources(): Partial<ManifestV3> | undefined {
        const resources: ManifestAccessibleResource[] = this.getWebAccessibleResources();

        const transformedResources = resources.map(resource => ({
            resources: resource.resources,
            matches: resource.matches || [],
        }));

        if (resources.length > 0) {
            return {web_accessible_resources: transformedResources};
        }
    }

    protected buildSandbox(): Partial<ManifestV3> | undefined {
        if (this.browser === Browser.Firefox) {
            return;
        }

        const rawSandbox = (this.combinedRaws.sandbox || {}) as Record<string, any>;
        const sandboxes = this.getSandboxes();

        if (sandboxes.length === 0 && Object.keys(rawSandbox).length === 0) {
            return;
        }

        return {
            sandbox: {
                ...rawSandbox,
                pages: sandboxes,
            },
        } as Partial<ManifestV3>;
    }

    protected buildCsp(): Partial<ManifestV3> | undefined {
        const rawCsp = this.combinedRaws.content_security_policy;
        const csp = this.csp.build();
        const sandboxCsp = this.sandboxCsp.build();

        if (this.browser === Browser.Firefox) {
            if (!rawCsp && !csp) {
                return;
            }

            if (typeof rawCsp === "string") {
                if (csp) {
                    throw new ManifestError(
                        "Cannot merge extension pages content security policy with a string content_security_policy."
                    );
                }

                return {content_security_policy: rawCsp} as Partial<ManifestV3>;
            }

            const {sandbox, ...contentCsp} = rawCsp || {};

            if (csp && contentCsp.extension_pages) {
                throw new ManifestError(
                    "Cannot merge extension pages content security policy with raw content_security_policy.extension_pages."
                );
            }

            if (csp) {
                contentCsp.extension_pages = csp;
            }

            return Object.keys(contentCsp).length > 0
                ? ({content_security_policy: contentCsp} as Partial<ManifestV3>)
                : undefined;
        }

        if (!rawCsp && !sandboxCsp && !csp) {
            return;
        }

        if (typeof rawCsp === "string") {
            if (sandboxCsp || csp) {
                throw new ManifestError(
                    "Cannot merge framework content security policy with a string content_security_policy."
                );
            }

            return {content_security_policy: rawCsp} as Partial<ManifestV3>;
        }

        if (csp && rawCsp?.extension_pages) {
            throw new ManifestError(
                "Cannot merge extension pages content security policy with raw content_security_policy.extension_pages."
            );
        }

        return {
            content_security_policy: {
                ...rawCsp,
                ...(csp ? {extension_pages: csp} : {}),
                ...(sandboxCsp || rawCsp?.sandbox ? {sandbox: sandboxCsp || rawCsp?.sandbox} : {}),
            },
        } as Partial<ManifestV3>;
    }
}
