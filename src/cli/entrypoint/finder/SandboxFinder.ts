import AbstractTransportFinder from "./AbstractTransportFinder";
import PluginFinder from "./PluginFinder";

import {SandboxParser} from "../parser";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";
import {SandboxEntrypointOptions, SandboxOptions} from "@typing/sandbox";

export default class extends AbstractTransportFinder<SandboxEntrypointOptions, SandboxOptions> {
    constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Sandbox;
    }

    protected getParser(): EntrypointParser<SandboxEntrypointOptions> {
        return new SandboxParser(this.config);
    }

    protected getPlugin(): EntrypointOptionsFinder<SandboxEntrypointOptions> {
        return new PluginFinder(this.config, "sandbox", this);
    }

    public canMerge(): boolean {
        return this.config.mergeSandbox;
    }
}
