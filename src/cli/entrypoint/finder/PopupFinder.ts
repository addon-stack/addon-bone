import ViewCspFinder from "./ViewCspFinder";
import PluginFinder from "./PluginFinder";

import {PopupParser} from "../parser";

import {ReadonlyConfig} from "@typing/config";
import {PopupEntrypointOptions} from "@typing/popup";
import {EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";

export default class extends ViewCspFinder<PopupEntrypointOptions> {
    constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Popup;
    }

    protected getParser(): EntrypointParser<PopupEntrypointOptions> {
        return new PopupParser(this.config);
    }

    protected getPlugin(): EntrypointOptionsFinder<PopupEntrypointOptions> {
        return new PluginFinder(this.config, "popup", this);
    }

    public canMerge(): boolean {
        return this.config.mergePopup;
    }

    public allowMultiple(): boolean {
        return this.config.multiplePopup;
    }
}
