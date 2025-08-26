import AbstractTransportFinder from "./AbstractTransportFinder";
import PluginFinder from "./PluginFinder";

import {RelayParser} from "../parser";

import {ReadonlyConfig} from "@typing/config";
import {RelayEntrypointOptions, RelayOptions} from "@typing/relay";
import {EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";

export default class extends AbstractTransportFinder<RelayEntrypointOptions, RelayOptions> {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Relay;
    }

    protected getParser(): EntrypointParser<RelayEntrypointOptions> {
        return new RelayParser(this.config);
    }

    protected getPlugin(): EntrypointOptionsFinder<RelayEntrypointOptions> {
        return new PluginFinder(this.config, "relay", this);
    }

    public canMerge(): boolean {
        return this.config.mergeRelay;
    }
}
