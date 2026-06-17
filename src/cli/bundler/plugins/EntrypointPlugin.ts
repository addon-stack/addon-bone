import _ from "lodash";
import path from "path";

import {Compiler, EntryNormalized} from "@rspack/core";

import VirtualModuleAdapter from "./VirtualModuleAdapter";

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

export default class EntrypointPlugin {
    private readonly pluginName: string = "EntrypointPlugin";

    private _plugin?: VirtualModuleAdapter;
    private _modules?: EntrypointPluginEntryModules;

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

    protected get plugin(): VirtualModuleAdapter {
        if (this._plugin) {
            return this._plugin;
        }

        const modules = Object.fromEntries(this.getModuleContents(this.modules));

        return (this._plugin = new VirtualModuleAdapter(modules));
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
                let currentFiles = structuredClone(entry[name] ?? []);

                if ("import" in currentFiles) {
                    currentFiles = currentFiles.import;
                }

                currentFiles.push(...Array.from(modules.values(), ({name}) => this.plugin.entryRequest(name)));

                entry[name] = {
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

        const addedContents = new Map(Array.from(updatedContents).filter(entry => !currentContents.has(entry[0])));

        // compiler.options.entry holds normalized requests (entryRequest), while the content
        // maps are keyed by storage name — map the removed names to requests so the filter matches.
        const removedRequests = new Set(Array.from(removedContents.keys(), name => this.plugin.entryRequest(name)));

        if (removedContents.size > 0 || addedContents.size > 0) {
            removedContents.keys().forEach(name => {
                this.plugin.writeModule(name, "");
            });

            addedContents.forEach((content, name) => {
                this.plugin.writeModule(name, content);
            });

            updatedModules.entries().forEach(([name, modules]) => {
                let entry: string[] = structuredClone(compiler.options.entry[name]);

                if ("import" in entry) {
                    entry = entry.import as string[];
                }

                entry = entry.filter(file => !removedRequests.has(file));

                entry.push(...Array.from(modules.values(), ({name}) => this.plugin.entryRequest(name)));

                compiler.options.entry[name] = _.uniq(entry);
            });
        }

        this._modules = updatedModules;
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
