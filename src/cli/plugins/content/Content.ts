import ContentDriver from "./ContentDriver";

import {ContentProvider} from "./types";

import {ContentFinder} from "@cli/entrypoint";
import {virtualContentScriptModule} from "@cli/virtual";
import {isContentScriptFrameNavigation} from "@shared/content";

import {ReadonlyConfig} from "@typing/config";
import {ContentScriptEntrypointOptions} from "@typing/content";
import {EntrypointFile} from "@typing/entrypoint";

export default class extends ContentFinder implements ContentProvider<ContentScriptEntrypointOptions> {
    protected _driver?: ContentDriver<ContentScriptEntrypointOptions>;

    constructor(config: ReadonlyConfig) {
        super(config);
    }

    public driver(): ContentDriver<ContentScriptEntrypointOptions> {
        return (this._driver ??= new ContentDriver(this));
    }

    public virtual(file: EntrypointFile, options?: ContentScriptEntrypointOptions): string {
        if (!this.holds(file)) {
            throw new Error(`File ${file} not found for content script`);
        }

        return virtualContentScriptModule(file, isContentScriptFrameNavigation(options?.isolation));
    }

    public clear(): this {
        this._driver?.clear();

        return super.clear();
    }
}
