import rspack, {Compilation, Compiler} from "@rspack/core";

import {getCompilationBuildAssets} from "@cli/bundler/utils/output";
import {getManifestHooks} from "../utils/manifest-hooks";

import {ManifestBuilder, ManifestDependencies, ManifestDependency} from "@typing/manifest";
import {EntrypointAssetsMap} from "@typing/entrypoint";

export const createManifestDependencies = (buildAssets: EntrypointAssetsMap): ManifestDependencies => {
    const entryDependencies: ManifestDependencies = new Map();

    Object.entries(buildAssets).forEach(([entryName, assets]) => {
        const dependencies: ManifestDependency = {
            assets: new Set([...assets.assets, ...assets.async.js, ...assets.async.css]),
            css: new Set(assets.initial.css),
            js: new Set(assets.initial.js),
        };

        entryDependencies.set(entryName, dependencies);
    });

    return entryDependencies;
};

class ManifestPlugin {
    constructor(private readonly manifest: ManifestBuilder | (() => ManifestBuilder)) {}

    apply(compiler: Compiler): void {
        compiler.hooks.compilation.tap("ManifestPlugin", compilation => {
            const hooks = getManifestHooks(compilation);

            compilation.hooks.processAssets.tapPromise(
                {
                    name: "ManifestPlugin",
                    stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
                },
                async () => {
                    try {
                        const buildAssets = getCompilationBuildAssets(compilation);

                        if (!buildAssets) {
                            throw new Error("Build assets are unavailable before manifest generation");
                        }

                        const dependencies = createManifestDependencies(buildAssets);
                        await hooks.prepareDependencies.promise(dependencies, buildAssets);

                        const builder = typeof this.manifest === "function" ? this.manifest() : this.manifest;
                        const manifest = builder.setDependencies(dependencies).get();
                        await hooks.validate.promise(manifest);

                        const json = JSON.stringify(manifest, null, 2);

                        compilation.emitAsset("manifest.json", new rspack.sources.RawSource(json));
                    } catch (error) {
                        // A manifest failure rejects this build without terminating the watch compiler.
                        compilation.errors.push(error instanceof Error ? error : new Error(String(error)));
                    }
                }
            );
        });
    }
}

export default ManifestPlugin;
