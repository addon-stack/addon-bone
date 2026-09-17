import ViewCspParser from "./ViewCspParser";

import {HistoryEntrypointOptions} from "@typing/override";

export default class HistoryParser extends ViewCspParser<HistoryEntrypointOptions> {
    protected definition(): string {
        return "defineHistory";
    }
}
