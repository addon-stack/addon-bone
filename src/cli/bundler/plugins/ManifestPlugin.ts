import rspack, {Compilation, Compiler} from "@rspack/core";

import {getCompilationBuildAssets} from "@cli/bundler/utils/output";

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
    constructor(private readonly manifest: ManifestBuilder) {}

    apply(compiler: Compiler): void {
        compiler.hooks.compilation.tap("ManifestPlugin", compilation => {
            compilation.hooks.processAssets.tap(
                {
                    name: "ManifestPlugin",
                    stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
                },
                () => {
                    const buildAssets = getCompilationBuildAssets(compilation);

                    if (!buildAssets) {
                        throw new Error("Build assets are unavailable before manifest generation");
                    }

                    const manifest = this.manifest.setDependencies(createManifestDependencies(buildAssets)).get();
                    const json = JSON.stringify(manifest, null, 2);

                    compilation.emitAsset("manifest.json", new rspack.sources.RawSource(json));
                }
            );
        });
    }
}

export default ManifestPlugin;
