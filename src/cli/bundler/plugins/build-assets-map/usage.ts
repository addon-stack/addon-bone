import type {Chunk, Compilation, Compiler, NormalModule} from "@rspack/core";

import type {RuntimePropertyOptions} from "../types";

export interface BuildAssetsMapPluginExportOptions extends RuntimePropertyOptions {
    readonly export: string;
}

export interface BuildAssetsMapPluginModuleOptions {
    readonly request: string;
    readonly current: BuildAssetsMapPluginExportOptions;
    readonly full: BuildAssetsMapPluginExportOptions;
}

/** Retain every layer's module before concatenation, then inspect export use per runtime. */
export const trackModuleUsage = (
    compiler: Compiler,
    compilation: Compilation,
    options: BuildAssetsMapPluginModuleOptions
): ((chunk: Chunk, name: string) => boolean) => {
    let resource: string | undefined;
    let modules: NormalModule[] = [];

    compilation.hooks.finishModules.tapPromise("BuildAssetsMapPlugin:resolve", async () => {
        const resolver = compiler.resolverFactory.get("normal", {dependencyType: "esm"});
        resource = await new Promise<string>((resolve, reject) => {
            resolver.resolve({}, compiler.context, options.request, {}, (error, result) => {
                if (error) reject(error);
                else if (typeof result !== "string")
                    reject(new Error(`Unable to resolve assets module "${options.request}"`));
                else resolve(result);
            });
        });
    });

    compilation.hooks.afterOptimizeModules.tap("BuildAssetsMapPlugin:usage", candidates => {
        modules = Array.from(candidates).filter(
            module => (module as NormalModule).resource === resource
        ) as NormalModule[];
    });

    return (chunk, name) => {
        const runtime = new Set(chunk.runtime);
        return modules.some(module => compilation.moduleGraph.getExportsInfo(module).getUsed(name, runtime) !== 0);
    };
};
