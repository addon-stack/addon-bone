import AbstractOverrideParser from "./AbstractOverrideParser";

import {HistoryEntrypointOptions} from "@typing/override";

export default class HistoryParser extends AbstractOverrideParser<HistoryEntrypointOptions> {
    protected definition(): string {
        return "defineHistory";
    }
}
