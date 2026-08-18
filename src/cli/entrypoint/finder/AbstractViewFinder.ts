import path from "path";

import {InlineNameGenerator, NameGenerator} from "../name";

import AbstractPluginFinder from "./AbstractPluginFinder";

import {ReadonlyConfig} from "@typing/config";
import {ViewEntrypointOptions} from "@typing/view";
import {EntrypointFile, EntrypointNameGenerator} from "@typing/entrypoint";

export interface ViewItem<O extends ViewEntrypointOptions> {
    filename: string;
    alias: string;
    file: EntrypointFile;
    options: O;
}

export type ViewItems<O extends ViewEntrypointOptions> = Map<string, ViewItem<O>>;

export type ViewAliasToFilename = Map<string, string>;

export type ViewFileToFilename = Map<EntrypointFile, string>;

export default abstract class<O extends ViewEntrypointOptions> extends AbstractPluginFinder<O> {
    protected _views?: ViewItems<O>;

    protected readonly names: EntrypointNameGenerator;
    protected readonly aliases: EntrypointNameGenerator;
    protected readonly filenames: EntrypointNameGenerator;

    protected constructor(config: ReadonlyConfig) {
        super(config);

        this.names = this.createNameGenerator();
        this.aliases = this.createAliasGenerator();
        this.filenames = this.createFilenameGenerator();
    }

    protected createNameGenerator(): EntrypointNameGenerator {
        return new NameGenerator(this.type());
    }

    protected createAliasGenerator(): EntrypointNameGenerator {
        return new InlineNameGenerator(this.type());
    }

    protected createFilenameGenerator(): EntrypointNameGenerator {
        return new NameGenerator(this.type());
    }

    protected async getViews(): Promise<ViewItems<O>> {
        const views: ViewItems<O> = new Map();
        const entries = [...(await this.plugin().options())];
        const candidates = this.allowMultiple() ? entries : entries.slice(-1);

        for (const [file, options] of candidates) {
            views.set(this.createViewName(file, options), {
                alias: this.createViewAlias(file, options),
                filename: this.createViewFilename(file, options),
                file,
                options,
            });
        }

        return views;
    }

    protected createViewFilename(file: EntrypointFile, options: O): string {
        const {as} = options;

        const filename = as ? this.filenames.name(as) : this.filenames.file(file);

        return path.posix.join(this.config.htmlDir, filename + ".html");
    }

    protected createViewAlias(file: EntrypointFile, options: O): string {
        const {as} = options;

        let alias = as ? this.aliases.name(as) : this.aliases.file(file);

        if (file.external) {
            alias = file.import;
        }

        return alias;
    }

    protected createViewName(file: EntrypointFile, options: O): string {
        const {as} = options;

        return as ? this.names.name(as) : this.names.file(file);
    }

    public async views(): Promise<ViewItems<O>> {
        return (this._views ??= await this.getViews());
    }

    public allowMultiple(): boolean {
        return true;
    }

    public async getAliasToFilename(): Promise<ViewAliasToFilename> {
        return Array.from(await this.views()).reduce((aliases, [_, item]) => {
            return {
                ...aliases,
                [item.alias]: item.filename,
            };
        }, new Map() as ViewAliasToFilename);
    }

    public async getAlias(): Promise<Set<string>> {
        const aliases = new Set<string>();

        const views = await this.views();

        for (const item of views.values()) {
            aliases.add(item.alias);
        }

        return aliases;
    }

    public async getFilenames(): Promise<ViewFileToFilename> {
        const views = await this.views();

        const filenames: ViewFileToFilename = new Map();

        for (const {file, filename} of views.values()) {
            filenames.set(file, filename);
        }

        return filenames;
    }

    public clear(): this {
        this._views = undefined;

        this.names.reset();
        this.aliases.reset();
        this.filenames.reset();

        return super.clear();
    }
}
