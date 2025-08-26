import ManifestBase, {ManifestError} from "./ManifestBase";

import {filterHostPatterns, filterPermissionsForMV3} from "./utils";

import {CoreManifest, ManifestVersion} from "@typing/manifest";
import {Browser} from "@typing/browser";
import {ContentScriptMatches} from "@typing/content";

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
        const permissions = Array.from(filterPermissionsForMV3(this.permissions));

        if (permissions.length > 0) {
            return {permissions};
        }
    }

    protected buildOptionalPermissions(): Partial<ManifestV3> | undefined {
        // prettier-ignore
        const optionalPermissions = Array
            .from(filterPermissionsForMV3(this.optionalPermissions))
            .filter((permission) => !this.permissions.has(permission));

        if (optionalPermissions.length > 0) {
            return {optional_permissions: optionalPermissions};
        }
    }

    protected buildHostPermissions(): Partial<ManifestV3> | undefined {
        if (this.hostPermissions.size > 0) {
            return {host_permissions: [...filterHostPatterns(this.hostPermissions)]};
        }
    }

    protected buildOptionalHostPermissions(): Partial<ManifestV3> | undefined {
        // prettier-ignore
        const optionalHostPermissions = Array
            .from(filterHostPatterns(new Set([...this.hostPermissions, ...this.optionalHostPermissions])))
            .filter((permission) => !this.hostPermissions.has(permission));

        if (optionalHostPermissions.length > 0) {
            return {optional_host_permissions: optionalHostPermissions};
        }
    }

    protected buildWebAccessibleResources(): Partial<ManifestV3> | undefined {
        const resources: Array<{resources: string[]; matches: string[]}> = [...this.accessibleResources];

        for (const contentScript of this.contentScripts.values()) {
            const assets = this.dependencies.get(contentScript.entry)?.assets;

            if (assets && assets.size > 0) {
                resources.push({
                    resources: Array.from(assets),
                    matches: contentScript.matches || ContentScriptMatches,
                });
            }
        }

        if (resources.length > 0) {
            return {web_accessible_resources: resources};
        }
    }
}
