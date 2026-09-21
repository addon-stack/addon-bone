import AbstractOverrideFinder from "./AbstractOverrideFinder";

import {HistoryParser} from "../parser";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointParser, EntrypointType} from "@typing/entrypoint";
import {HistoryEntrypointOptions, OverrideEntrypointType} from "@typing/override";

export default class HistoryFinder extends AbstractOverrideFinder<HistoryEntrypointOptions> {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): OverrideEntrypointType {
        return EntrypointType.History;
    }

    protected getParser(): EntrypointParser<HistoryEntrypointOptions> {
        return new HistoryParser(this.config);
    }
}
