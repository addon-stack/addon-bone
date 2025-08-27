import AbstractFinder from "./AbstractFinder";
import {
    EntrypointFile,
    EntrypointOptions,
    EntrypointOptionsFinder,
    EntrypointParser,
    EntrypointType,
} from "@typing/entrypoint";

export default abstract class<O extends EntrypointOptions>
    extends AbstractFinder
    implements EntrypointOptionsFinder<O>
{
    protected _parser?: EntrypointParser<O>;
    protected _options?: Map<EntrypointFile, O>;
    protected _contract?: Map<EntrypointFile, string | undefined>;

    public abstract type(): EntrypointType;

    protected abstract getParser(): EntrypointParser<O>;

    public parser(): EntrypointParser<O> {
        return (this._parser ??= this.getParser());
    }

    public async options(): Promise<Map<EntrypointFile, O>> {
        return (this._options ??= await this.getOptions());
    }

    public async contracts(): Promise<Map<EntrypointFile, string | undefined>> {
        return (this._contract ??= await this.getContracts());
    }

    protected async getContracts(): Promise<Map<EntrypointFile, string | undefined>> {
        const collect = new Map<EntrypointFile, string | undefined>();

        const options = await this.options();

        for (const file of options.keys()) {
            collect.set(file, this.parser().contract(file));
        }

        return collect;
    }

    protected async getOptions(): Promise<Map<EntrypointFile, O>> {
        const collect = new Map<EntrypointFile, O>();

        for (const file of await this.files()) {
            const options = this.parser().options(file);

            if (!this.isValidOptions(options)) {
                continue;
            }

            collect.set(file, options);
        }

        return collect;
    }

    protected isValidOptions(options: O): boolean {
        const {
            browser,
            app,
            mode: configMode,
            debug: configDebug,
            manifestVersion: configManifestVersion
        } = this.config;

        const {
            mode,
            debug,
            manifestVersion,
            includeBrowser = [],
            includeApp = [],
            excludeBrowser = [],
            excludeApp = [],
        } = options;

        if (mode && mode !== configMode) {
            return false;
        }

        if (debug !== undefined && debug !== configDebug) {
            return false;
        }

        if (manifestVersion && manifestVersion !== configManifestVersion) {
            return false;
        }

        if (includeBrowser.length > 0 && !includeBrowser.includes(browser)) {
            return false;
        }

        if (includeApp.length > 0 && !includeApp.includes(app)) {
            return false;
        }

        if (excludeBrowser.length > 0 && excludeBrowser.includes(browser)) {
            return false;
        }

        return !(excludeApp.length > 0 && excludeApp.includes(app));
    }

    public clear(): this {
        this._options = undefined;
        this._contract = undefined;

        return super.clear();
    }
}
