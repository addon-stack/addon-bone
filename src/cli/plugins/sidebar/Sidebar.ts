import {View} from "../view";

import {modifyLocaleMessageKey} from "@shared/locale";

import {SidebarFinder} from "@cli/entrypoint";

import {ReadonlyConfig} from "@typing/config";
import {SidebarAliasMap, SidebarEntrypointOptions} from "@typing/sidebar";
import {ManifestSidebar} from "@typing/manifest";

export default class Sidebar extends SidebarFinder {
    protected _view?: View<SidebarEntrypointOptions>;

    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public view(): View<SidebarEntrypointOptions> {
        return (this._view ??= new View(this.config, this));
    }

    public async manifest(): Promise<ManifestSidebar | undefined> {
        const views = await this.views();

        for (const {filename, options} of views.values()) {
            const {apply = true, label, icon} = options;

            if (apply) {
                return {
                    path: filename,
                    title: modifyLocaleMessageKey(label),
                    icon,
                };
            }
        }
    }

    public async entriesByAlias(): Promise<SidebarAliasMap> {
        return Array.from(await this.views()).reduce((aliases, [_, item]) => {
            const {options, filename} = item;
            const {label, icon} = options;

            return {
                ...aliases,
                [item.alias]: {
                    path: filename,
                    label,
                    icon,
                },
            };
        }, {} as SidebarAliasMap);
    }

    public clear(): this {
        this._view = undefined;

        return super.clear();
    }
}
