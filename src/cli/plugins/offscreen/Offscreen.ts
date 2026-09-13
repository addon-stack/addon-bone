import _ from "lodash";

import {View} from "../view";

import {OffscreenFinder, OffscreenViewFinder} from "@cli/entrypoint";

import {virtualOffscreenModule} from "@cli/virtual";

import {ReadonlyConfig} from "@typing/config";
import {OffscreenEntrypointOptions, OffscreenParametersMap} from "@typing/offscreen";
import {EntrypointFile} from "@typing/entrypoint";

export default class extends OffscreenFinder {
    protected _view?: View<OffscreenEntrypointOptions>;

    protected _views?: OffscreenViewFinder;

    constructor(config: ReadonlyConfig) {
        super(config);

        this.names.reserve(this.chunkName());
    }

    public chunkName(): string {
        return "common." + this.type();
    }

    public likely(name?: string): boolean {
        return this.names.likely(name);
    }

    public view(): View<OffscreenEntrypointOptions> {
        return (this._view ??= new View(this.config, this.views()));
    }

    public views(): OffscreenViewFinder {
        return (this._views ??= new OffscreenViewFinder(this.config, this));
    }

    /**
     * Before creating the virtual module, it is necessary to run a command `await this.transport()` that caches the Offscreens.
     * This command is executed during the type declaration generation stage for the Offscreens.
     */
    public virtual(file: EntrypointFile): string {
        const options = this._transport?.get(file)?.options;

        if (!options) {
            throw new Error(`Offscreen options not found for "${file}"`);
        }

        return virtualOffscreenModule(file, options.name);
    }

    public async parameters(): Promise<OffscreenParametersMap> {
        const offscreens: OffscreenParametersMap = {};

        const files = await this.transport();
        const filenames = await this.views().getFilenames();

        for (const [file, transport] of files) {
            const url = filenames.get(file);

            if (!url) {
                throw new Error(`Offscreen filename not found for "${file.file}"`);
            }

            let {name, reasons = "DOM_PARSER", justification = "Just for testing"} = transport.options;

            if (_.isString(reasons)) {
                reasons = [reasons];
            }

            offscreens[name] = {
                url,
                reasons,
                justification,
            };
        }

        return offscreens;
    }

    public clear(): this {
        this._view = undefined;
        this._views = undefined;

        return super.clear();
    }
}
