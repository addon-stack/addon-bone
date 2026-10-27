import {View} from "../view";

import {modifyLocaleMessageKey} from "@shared/locale";

import {PopupFinder} from "@cli/entrypoint";

import {ReadonlyConfig} from "@typing/config";
import {PopupAliasMap, PopupEntrypointOptions} from "@typing/popup";
import {ManifestPopup} from "@typing/manifest";

export default class Popup extends PopupFinder {
    protected _view?: View<PopupEntrypointOptions>;

    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public view(): View<PopupEntrypointOptions> {
        return (this._view ??= new View(this.config, this));
    }

    public async manifest(): Promise<ManifestPopup | undefined> {
        const views = await this.views();

        for (const {filename, options} of views.values()) {
            const {apply = true, tooltip, icon} = options;

            if (apply) {
                return {
                    path: filename,
                    title: modifyLocaleMessageKey(tooltip),
                    icon,
                };
            }
        }
    }

    public async entriesByAlias(): Promise<PopupAliasMap> {
        return Array.from(await this.views()).reduce((aliases, [_, item]) => {
            const {options, filename} = item;
            const {tooltip, icon} = options;

            return {
                ...aliases,
                [item.alias]: {
                    path: filename,
                    tooltip,
                    icon,
                },
            };
        }, {} as PopupAliasMap);
    }

    public clear(): this {
        this._view = undefined;

        return super.clear();
    }
}
