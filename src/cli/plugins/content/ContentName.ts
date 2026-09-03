import stringify from "json-stringify-deterministic";

import {getContentScriptConfigFromOptions} from "./utils";
import {ContentNameGenerator} from "./types";

import {NameGenerator} from "@cli/entrypoint";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointType} from "@typing/entrypoint";
import {ContentScriptEntrypointOptions} from "@typing/content";

export default class ContentName extends NameGenerator implements ContentNameGenerator<ContentScriptEntrypointOptions> {
    protected readonly _names = new Map<string, string>();

    constructor(protected readonly config: ReadonlyConfig) {
        super(EntrypointType.ContentScript);
    }

    public create(name: string, options: ContentScriptEntrypointOptions): string {
        if (!this.config.concatContentScripts) {
            return this.name(name);
        }

        const key = stringify(getContentScriptConfigFromOptions(options));

        const existingEntry = this._names.get(key);

        if (existingEntry) {
            return existingEntry;
        }

        const entry = this.name(name);

        this._names.set(key, entry);

        return entry;
    }

    public reset(): this {
        this._names.clear();

        return super.reset();
    }
}
