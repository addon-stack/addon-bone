import ViewCspFinder from "./ViewCspFinder";
import PluginFinder from "./PluginFinder";

import {SidebarParser} from "../parser";

import {ReadonlyConfig} from "@typing/config";
import {SidebarEntrypointOptions} from "@typing/sidebar";
import {EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";

export default class extends ViewCspFinder<SidebarEntrypointOptions> {
    constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Sidebar;
    }

    protected getParser(): EntrypointParser<SidebarEntrypointOptions> {
        return new SidebarParser(this.config);
    }

    protected getPlugin(): EntrypointOptionsFinder<SidebarEntrypointOptions> {
        return new PluginFinder(this.config, "sidebar", this);
    }

    public canMerge(): boolean {
        return this.config.mergeSidebar;
    }

    public allowMultiple(): boolean {
        return this.config.multipleSidebar;
    }
}
