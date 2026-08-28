import FileBuilder from "../../FileBuilder";

import {ReadonlyConfig} from "@typing/config";

export default class extends FileBuilder {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    protected filename(): string {
        return "vendor.d.ts";
    }

    protected url(): string {
        return import.meta.url;
    }

    protected template(): string {
        return this.readFile();
    }
}
