import ViewCspParser from "./ViewCspParser";

import {NewtabEntrypointOptions} from "@typing/override";

export default class NewtabParser extends ViewCspParser<NewtabEntrypointOptions> {
    protected definition(): string {
        return "defineNewtab";
    }
}
