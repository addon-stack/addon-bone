import AbstractOverrideParser from "./AbstractOverrideParser";

import {NewtabEntrypointOptions} from "@typing/override";

export default class NewtabParser extends AbstractOverrideParser<NewtabEntrypointOptions> {
    protected definition(): string {
        return "defineNewtab";
    }
}
