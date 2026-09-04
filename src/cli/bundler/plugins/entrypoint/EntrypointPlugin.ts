import _ from "lodash";
import path from "path";

import {Compiler, type EntryDescription, EntryNormalized} from "@rspack/core";
import {RspackVirtualModulePlugin as VirtualModulesPlugin} from "rspack-plugin-virtual-module";

import {EntrypointEntries, EntrypointFile} from "@typing/entrypoint";

export type EntrypointPluginTemplate = (file: EntrypointFile) => string;

export type EntrypointPluginUpdate = (files: ReadonlySet<string>) => Promise<EntrypointEntries>;

export interface EntrypointPluginModule {
    /**
     * Virtual module name, used in the rspack entry and virtual module.
     */
    name: string;

    /**
     * Virtual module content.
     */
    module: string;
}

export type EntrypointPluginModules = Map<EntrypointFile, EntrypointPluginModule>;

export type EntrypointPluginEntryModules = Map<string, EntrypointPluginModules>;

export type EntrypointPluginEntryOptions = Omit<EntryDescription, "import">;

export type EntrypointPluginEntryOptionsResolver = (name: string) => EntrypointPluginEntryOptions;

export default class EntrypointPlugin {
    private readonly pluginName: string = "EntrypointPlugin";

    private _plugin?: VirtualModulesPlugin;
    private _modules?: EntrypointPluginEntryModules;
    private readonly _entryOptions: EntrypointPluginEntryOptionsResolver[] = [];

    protected template?: EntrypointPluginTemplate;
    protected update?: EntrypointPluginUpdate;

    public static filename(file: EntrypointFile): string {
        let name = file.file;

        if (file.external) {
            const {ext} = path.parse(name);
            name = file.import + ext;
        }

        return path.join("virtual", name);
    }

    protected get plugin(): VirtualModulesPlugin {
        if (this._plugin) {
            return this._plugin;
        }

        const modules = Object.fromEntries(this.getModuleContents(this.modules));

        return (this._plugin = new VirtualModulesPlugin(modules, "entrypoint"));
    }

    protected get modules(): EntrypointPluginEntryModules {
        return (this._modules ??= this.createModules(this.entries));
    }

    protected get watchFiles(): ReadonlySet<string> {
        const files = Array.from(this.modules.values())
            .flatMap(modules => Array.from(modules.keys()))
            .filter(({external}) => !external)
            .map(({file}) => file);

        return new Set(files);
    }

    public static from(entries: EntrypointEntries): EntrypointPlugin {
        return new EntrypointPlugin(entries);
    }

    constructor(private readonly entries: EntrypointEntries = new Map()) {}

    public virtual(template: EntrypointPluginTemplate): this {
        this.template = template;

        return this;
    }

    public entryOptions(options: EntrypointPluginEntryOptions | EntrypointPluginEntryOptionsResolver): this {
        this._entryOptions.push(_.isFunction(options) ? options : () => options);

        return this;
    }

    public watch(update: EntrypointPluginUpdate): this {
        this.update = update;

        return this;
    }

    public apply(compiler: Compiler): void {
        this.plugin.apply(compiler);

        compiler.hooks.entryOption.tap(this.pluginName, (_, entry) => {
            this.hookEntryOption(entry);
        });

        if (this.update) {
            compiler.hooks.watchRun.tapAsync(this.pluginName, (compiler, callback) => {
                this.hookWatchRun(compiler)
                    .then(() => callback())
                    .catch(callback);
            });
        }
    }

    protected hookEntryOption(entry: EntryNormalized): void {
        if (_.isPlainObject(entry)) {
            this.modules.entries().forEach(([name, modules]) => {
                const current = structuredClone(entry[name] ?? []);
                let currentFiles = current;
                let currentOptions: EntrypointPluginEntryOptions = {};

                if ("import" in currentFiles) {
                    currentOptions = currentFiles;
                    currentFiles = currentFiles.import;
                }

                currentFiles.push(...Array.from(modules.values(), ({name}) => name));

                entry[name] = {
                    ...currentOptions,
                    ...this.resolveEntryOptions(name),
                    import: _.uniq(currentFiles),
                };
            });
        } else {
            throw new Error("EntrypointPlugin: entry is not an object");
        }
    }

    protected async hookWatchRun(compiler: Compiler): Promise<void> {
        const {modifiedFiles = new Set()} = compiler;

        const watchFiles = this.watchFiles;

        const needUpdate = Array.from(modifiedFiles).some(file => {
            if (path.isAbsolute(file)) {
                file = path.relative(compiler.context, file);
            }

            return watchFiles.has(file);
        });

        if (!needUpdate) {
            return;
        }

        const updatedEntries = await this.update!(modifiedFiles);

        const updatedModules = this.createModules(updatedEntries);

        const currentContents = this.getModuleContents(this.modules);
        const updatedContents = this.getModuleContents(updatedModules);

        const removedContents = new Map(Array.from(currentContents).filter(entry => !updatedContents.has(entry[0])));

        const changedContents = new Map(
            Array.from(updatedContents).filter(([name, content]) => currentContents.get(name) !== content)
        );

        removedContents.keys().forEach(name => {
            this.plugin.writeModule(name, "");
        });

        changedContents.forEach((content, name) => {
            this.plugin.writeModule(name, content);
        });

        this.modules.keys().forEach(name => {
            if (!updatedModules.has(name)) {
                delete compiler.options.entry[name];
            }
        });

        updatedModules.entries().forEach(([name, modules]) => {
            const current = structuredClone(compiler.options.entry[name] ?? []);
            let entry = current;
            let currentOptions: EntrypointPluginEntryOptions = {};

            if ("import" in entry) {
                currentOptions = entry;
                entry = entry.import as string[];
            }

            entry = entry.filter(file => !removedContents.has(file));

            entry.push(...Array.from(modules.values(), ({name}) => name));

            compiler.options.entry[name] = {
                ...currentOptions,
                ...this.resolveEntryOptions(name),
                import: _.uniq(entry),
            };
        });

        this._modules = updatedModules;
    }

    protected resolveEntryOptions(name: string): EntrypointPluginEntryOptions {
        return Object.assign({}, ...this._entryOptions.map(resolve => resolve(name)));
    }

    protected createModules(entries: EntrypointEntries): EntrypointPluginEntryModules {
        const entryModules: EntrypointPluginEntryModules = new Map();

        for (const [name, files] of entries) {
            const modules: EntrypointPluginModules = new Map();

            for (const file of files) {
                modules.set(file, {
                    name: EntrypointPlugin.filename(file),
                    module: this.template ? this.template(file) : "",
                });
            }

            entryModules.set(name, modules);
        }

        return entryModules;
    }

    protected getModuleContents(modules: EntrypointPluginEntryModules): Map<string, string> {
        const content = new Map<string, string>();

        modules.values().forEach(modules => {
            modules.forEach(({name, module}) => {
                content.set(name, module);
            });
        });

        return content;
    }
}
