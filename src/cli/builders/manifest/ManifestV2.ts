import ManifestBase from "./ManifestBase";

import {filterHostPatterns, filterPermissionsForMV2} from "./utils";

import {CoreManifest, ManifestVersion} from "@typing/manifest";
import {Browser} from "@typing/browser";
import {SidebarAlternativeBrowsers} from "@typing/sidebar";

type ManifestV2 = chrome.runtime.ManifestV2;
type ManifestV3 = chrome.runtime.ManifestV3;

export default class extends ManifestBase<ManifestV2> {

    public constructor(browser: Browser) {
        super(browser);
    }

    public getManifestVersion(): ManifestVersion {
        return 2;
    }

    protected buildAction(): Partial<ManifestV2> | undefined {
        if (this.popup) {
            const {icon, title, path} = this.popup;

            return {
                browser_action: {
                    default_title: title || this.name,
                    default_popup: path,
                    default_icon: this.getIconsByName(icon),
                }
            };
        } else if (this.hasExecuteActionCommand()) {
            return {
                browser_action: {
                    default_title: this.name,
                }
            };
        }
    }

    protected buildSidebar(): Partial<CoreManifest> | undefined {
        if (!SidebarAlternativeBrowsers.has(this.browser)) {
            return;
        }

        return super.buildSidebar();
    }

    protected buildContentScripts(): Partial<ManifestV2> | undefined {
        const manifest = super.buildContentScripts() as Partial<ManifestV3>;

        if (manifest) {
            const {content_scripts} = manifest;

            if (!content_scripts) {
                return;
            }

            const contentScripts = content_scripts
                .map(({world, ...script}) => script);

            return {content_scripts: contentScripts};
        }
    }

    protected buildPermissions(): Partial<ManifestV2> | undefined {
        const permissions: string[] = Array.from(filterPermissionsForMV2(this.permissions));

        if (this.hostPermissions.size > 0) {
            permissions.push(...filterHostPatterns(this.hostPermissions));
        }

        if (permissions.length > 0) {
            return {permissions};
        }
    }

    protected buildHostPermissions(): Partial<ManifestV2> | undefined {
        // In Manifest V2, host permissions are declared in the "permissions" array

        return undefined;
    }

    protected buildWebAccessibleResources(): Partial<ManifestV2> | undefined {
        const resources: string[] = Array.from(this.accessibleResources).flatMap(({resources}) => resources);

        for (const contentScript of this.contentScripts.values()) {
            const assets = this.dependencies.get(contentScript.entry)?.assets;

            if (assets && assets.size > 0) {
                resources.push(...assets);
            }
        }

        if (resources.length > 0) {
            return {web_accessible_resources: Array.from(new Set(resources))};
        }
    }

}