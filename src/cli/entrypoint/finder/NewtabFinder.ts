import AbstractOverrideFinder from "./AbstractOverrideFinder";

import {NewtabParser} from "../parser";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointParser, EntrypointType} from "@typing/entrypoint";
import {NewtabEntrypointOptions, OverrideEntrypointType} from "@typing/override";

export default class NewtabFinder extends AbstractOverrideFinder<NewtabEntrypointOptions> {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): OverrideEntrypointType {
        return EntrypointType.Newtab;
    }

    protected getParser(): EntrypointParser<NewtabEntrypointOptions> {
        return new NewtabParser(this.config);
    }
}
