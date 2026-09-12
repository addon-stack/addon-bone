import {randomUUID} from "crypto";
import {existsSync} from "fs";
import path from "path";
import type {Compiler, RuleSetCondition} from "@rspack/core";
import {RspackVirtualModulePlugin} from "rspack-plugin-virtual-module";
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

        // The underlying plugin removes its entire directory on shutdown.
        const plugin = new RspackVirtualModulePlugin(modules, `generate-module-${randomUUID()}`);
        plugin.apply(compiler);

        if (this.moduleLayer !== undefined) {
            const resources = Object.keys(modules).map(name => compiler.options.resolve.alias![name] as string);
            compiler.options.module.rules.push({
                include: resources,
                layer: this.moduleLayer,
                issuerLayer: this.issuerLayer,
            });
        }

        compiler.hooks.compilation.tap(this.pluginName, compilation => {
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
                    plugin.writeModule(name, source);
                    modules[name] = source;
                }
            }
        });
    }
}
