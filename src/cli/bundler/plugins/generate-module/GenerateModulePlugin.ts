import {existsSync} from "fs";
import path from "path";
import {experiments, type Compiler, type RuleSetCondition} from "@rspack/core";
import {watchCompilation} from "../utils";

/** JavaScript source keyed by the module's import specifier. */
export type GenerateModulePluginModules = Record<string, string>;

/** Returns source updates for the registered modules. */
export type GenerateModulePluginUpdate = () => Promise<GenerateModulePluginModules>;

export interface GenerateModulePluginDependencies {
    files?: Iterable<string>;
    directories?: Iterable<string>;
}

export type GenerateModulePluginDependenciesResolver = () => Promise<GenerateModulePluginDependencies>;

export default class GenerateModulePlugin {
    private readonly pluginName = "GenerateModulePlugin";
    private update?: GenerateModulePluginUpdate;
    private dependencies?: GenerateModulePluginDependenciesResolver;
    private moduleLayer?: string;
    private issuerLayer?: RuleSetCondition;

    constructor(private readonly modules: GenerateModulePluginModules) {}

    /** Share a module layer for matching issuers; other issuers keep their inherited layer. */
    public layer(name: string, issuerLayer?: RuleSetCondition): this {
        this.moduleLayer = name;
        this.issuerLayer = issuerLayer;
        return this;
    }

    public watch(update: GenerateModulePluginUpdate, dependencies?: GenerateModulePluginDependenciesResolver): this {
        this.update = update;
        this.dependencies = dependencies;
        return this;
    }

    public apply(compiler: Compiler): void {
        const modules = {...this.modules};
        let dependencies: GenerateModulePluginDependencies = {};

        // Stable paths keep module IDs and hashes reproducible. The native store belongs
        // to this compiler, so concurrent builds never share files or cleanup ownership.
        const resources = Object.fromEntries(
            Object.keys(modules).map(name => [
                name,
                path.resolve(
                    compiler.context,
                    "node_modules",
                    ".adnbn-virtual",
                    path.extname(name) ? name : `${name}.js`
                ),
            ])
        );
        const plugin = new experiments.VirtualModulesPlugin(
            Object.fromEntries(Object.entries(modules).map(([name, source]) => [resources[name], source]))
        );
        plugin.apply(compiler);
        compiler.options.resolve.alias = {...compiler.options.resolve.alias, ...resources};
        const pending = new Map<string, string>();
        let initialized = false;

        if (this.moduleLayer !== undefined) {
            compiler.options.module.rules.push({
                include: Object.values(resources),
                layer: this.moduleLayer,
                issuerLayer: this.issuerLayer,
            });
        }

        compiler.hooks.compilation.tap(this.pluginName, compilation => {
            // Native virtual files can be updated only after the Rust compiler exists.
            for (const [name, source] of pending) plugin.writeModule(resources[name], source);
            pending.clear();
            initialized = true;

            for (const file of dependencies.files ?? []) {
                compilation.fileDependencies.add(path.resolve(compiler.context, file));
            }

            for (const directory of dependencies.directories ?? []) {
                const absolute = path.resolve(compiler.context, directory);
                const target = existsSync(absolute) ? compilation.contextDependencies : compilation.missingDependencies;
                target.add(absolute);
            }
        });

        watchCompilation(compiler, this.pluginName, async () => {
            dependencies = (await this.dependencies?.()) ?? {};
            if (!this.update) return;

            for (const [name, source] of Object.entries(await this.update())) {
                if (modules[name] !== source) {
                    if (initialized) {
                        plugin.writeModule(resources[name], source);
                        // watchRun precedes native cache invalidation. Include generated changes
                        // in this rebuild rather than waiting for a second filesystem event.
                        compiler.modifiedFiles = new Set([...(compiler.modifiedFiles ?? []), resources[name]]);
                    } else {
                        pending.set(name, source);
                    }
                    modules[name] = source;
                }
            }
        });
    }
}
