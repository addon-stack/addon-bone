import AbstractTransportFinder from "./AbstractTransportFinder";
import ViewCspFinder from "./ViewCspFinder";

import {ViewItems} from "./AbstractViewFinder";

import {ReadonlyConfig} from "@typing/config";
import {SandboxCspConfig, SandboxEntrypointOptions} from "@typing/sandbox";
import {EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";

export default class extends ViewCspFinder<SandboxEntrypointOptions, SandboxCspConfig> {
    constructor(
        config: ReadonlyConfig,
        protected readonly finder: AbstractTransportFinder<SandboxEntrypointOptions>
    ) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Sandbox;
    }

    protected getParser(): EntrypointParser<SandboxEntrypointOptions> {
        return this.finder.parser();
    }

    protected getPlugin(): EntrypointOptionsFinder<SandboxEntrypointOptions> {
        return this.finder.plugin();
    }

    protected async getViews(): Promise<ViewItems<SandboxEntrypointOptions>> {
        const views = await super.getViews();

        for (const view of views.values()) {
            const {name, csp, readyTimeout, requestTimeout, removeOnRequestTimeout, ...options} = view.options;

            view.options = options;
        }

        return views;
    }

    public canMerge(): boolean {
        return this.config.mergeSandbox;
    }
}
