import {ContentDriver as ContentDriverContract, ContentItems} from "./types";

import {AbstractPluginFinder, InlineNameGenerator} from "@cli/entrypoint";

import {ContentScriptEntrypointOptions} from "@typing/content";
import {EntrypointFile, EntrypointNameGenerator, EntrypointOptions} from "@typing/entrypoint";
import {ManifestOptionalPermissions, ManifestPermissions} from "@typing/manifest";

/**
 * OutputOptions stays first so existing ContentDriver<O> consumers keep their original meaning.
 * Drivers with a different input shape must override transform().
 */
export default class<
    OutputOptions extends ContentScriptEntrypointOptions = ContentScriptEntrypointOptions,
    InputOptions extends EntrypointOptions = OutputOptions,
> implements ContentDriverContract<OutputOptions> {
    protected _options?: Map<EntrypointFile, InputOptions>;

    protected _items?: ContentItems<OutputOptions>;

    protected _permissions?: Promise<[ManifestPermissions, ManifestOptionalPermissions]>;

    protected readonly itemNames: EntrypointNameGenerator;

    constructor(protected readonly finder: AbstractPluginFinder<InputOptions>) {
        this.itemNames = new InlineNameGenerator(this.finder.type());
    }

    protected transform(options: InputOptions): OutputOptions {
        return options as unknown as OutputOptions;
    }

    protected async getOptions(): Promise<Map<EntrypointFile, InputOptions>> {
        return (this._options ??= await this.finder.plugin().options());
    }

    protected async getItems(): Promise<ContentItems<OutputOptions>> {
        const items: ContentItems<OutputOptions> = new Map();

        const files = await this.getOptions();

        for (const [file, options] of files) {
            items.set(this.itemNames.file(file), {file, options: this.transform(options)});
        }

        return items;
    }

    public async items(): Promise<ContentItems<OutputOptions>> {
        return (this._items ??= await this.getItems());
    }

    protected async calculatePermissions(): Promise<[ManifestPermissions, ManifestOptionalPermissions]> {
        return [new Set(), new Set()];
    }

    protected getPermissions(): Promise<[ManifestPermissions, ManifestOptionalPermissions]> {
        return (this._permissions ??= this.calculatePermissions());
    }

    public async permissions(): Promise<ManifestPermissions> {
        return (await this.getPermissions())[0];
    }

    public async optionalPermissions(): Promise<ManifestOptionalPermissions> {
        return (await this.getPermissions())[1];
    }

    public clear(): this {
        this._options = undefined;
        this._items = undefined;
        this._permissions = undefined;

        this.itemNames.reset();

        return this;
    }
}
