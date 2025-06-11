import {View} from "../view";

import {modifyLocaleMessageKey} from "@locale/utils";

import {SidebarFinder} from "@cli/entrypoint";

import {ReadonlyConfig} from "@typing/config";
import {SidebarEntrypointOptions} from "@typing/sidebar";
import {ManifestSidebar} from "@typing/manifest";

export default class extends SidebarFinder {
    protected _view?: View<SidebarEntrypointOptions>;

    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public view(): View<SidebarEntrypointOptions> {
        return this._view ??= new View(this.config, this);
    }

    public async manifest(): Promise<ManifestSidebar | undefined> {
        const views = await this.views();

        for (const {filename, options} of views.values()) {
            const {apply = true, title, icon} = options;

            if (apply) {
                return {
                    path: filename,
                    title: modifyLocaleMessageKey(title),
                    icon,
                };
            }
        }
    }

    public async manifestByAlias(): Promise<Map<string, ManifestSidebar>> {
        return Array.from(await this.views()).reduce((aliases, [_, item]) => {
            const {options, filename} = item;
            const {title, icon} = options;

            return {
                ...aliases,
                [item.alias]: {
                    path: filename,
                    title,
                    icon,
                }
            };
        }, {} as Map<string, ManifestSidebar>);
    }

    public clear(): this {
        this._view = undefined;

        return super.clear();
    }
}