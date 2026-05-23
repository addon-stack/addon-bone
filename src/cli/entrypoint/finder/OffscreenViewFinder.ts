import ViewCspFinder from "./ViewCspFinder";
import AbstractTransportFinder from "./AbstractTransportFinder";

import {ReadonlyConfig} from "@typing/config";
import {OffscreenEntrypointOptions} from "@typing/offscreen";
import {EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";

export default class extends ViewCspFinder<OffscreenEntrypointOptions> {
    constructor(
        config: ReadonlyConfig,
        protected readonly finder: AbstractTransportFinder<OffscreenEntrypointOptions>
    ) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Offscreen;
    }

    protected getParser(): EntrypointParser<OffscreenEntrypointOptions> {
        return this.finder.parser();
    }

    protected getPlugin(): EntrypointOptionsFinder<OffscreenEntrypointOptions> {
        return this.finder.plugin();
    }

    public canMerge(): boolean {
        return this.config.mergeOffscreen;
    }
}
