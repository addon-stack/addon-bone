import ViewCspFinder from "./ViewCspFinder";
import PluginFinder from "./PluginFinder";

import {OptionsParser} from "../parser";

import type {ViewItems} from "./AbstractViewFinder";
import type {ReadonlyConfig} from "@typing/config";
import type {OptionsEntrypointOptions} from "@typing/options";
import {EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";

export default class extends ViewCspFinder<OptionsEntrypointOptions> {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Options;
    }

    protected getParser(): EntrypointParser<OptionsEntrypointOptions> {
        return new OptionsParser(this.config);
    }

    protected getPlugin(): EntrypointOptionsFinder<OptionsEntrypointOptions> {
        return new PluginFinder(this.config, "options", this);
    }

    protected async getViews(): Promise<ViewItems<OptionsEntrypointOptions>> {
        const views = await super.getViews();

        for (const view of views.values()) {
            const {openInTab, ...options} = view.options;

            view.options = options;
        }

        return views;
    }

    public allowMultiple(): boolean {
        return false;
    }
}
