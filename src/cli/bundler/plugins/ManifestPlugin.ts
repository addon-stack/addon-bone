import rspack, {Chunk, Compilation, Compiler} from "@rspack/core";

import {toPosix} from "@cli/utils/path";

import {ManifestBuilder, ManifestDependencies, ManifestDependency} from "@typing/manifest";

class ManifestPlugin {
    // A getter (not a fixed instance) so the plugin always reads the latest manifest — watch/dev
    // recreate it on every rebuild to avoid accumulating stale permissions/csp/content-scripts.
    constructor(private readonly manifest: () => ManifestBuilder) {}

    apply(compiler: Compiler): void {
        compiler.hooks.compilation.tap("ManifestPlugin", compilation => {
            compilation.hooks.processAssets.tap(
                {
                    name: "ManifestPlugin",
                    stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
                },
                () => {
                    const entryDependencies: ManifestDependencies = new Map();

                    compilation.entrypoints.forEach((entryPoint, entryName) => {
                        const dependencies: ManifestDependency = {
                            assets: new Set(),
                            css: new Set(),
                            js: new Set(),
                        };

                        const allChunks = new Set<Chunk>();

                        this.collectAllChunks(entryPoint, allChunks);

                        allChunks.forEach((chunk: Chunk) => {
                            chunk.files.forEach((fileName: string) => {
                                fileName = toPosix(fileName);

                                if (fileName.endsWith(".js")) {
                                    dependencies.js.add(fileName);
                                } else if (fileName.endsWith(".css")) {
                                    dependencies.css.add(fileName);
                                } else if (this.isAsset(fileName)) {
                                    dependencies.assets.add(fileName);
                                }
                            });

                            const auxiliaryFiles = chunk.auxiliaryFiles || [];

                            auxiliaryFiles.forEach((fileName: string) => {
                                fileName = toPosix(fileName);

                                if (fileName.endsWith(".css")) {
                                    dependencies.css.add(fileName);
                                } else if (this.isAsset(fileName)) {
                                    dependencies.assets.add(fileName);
                                }
                            });
                        });

                        entryDependencies.set(entryName, dependencies);
                    });

                    const manifest = this.manifest().setDependencies(entryDependencies).get();
                    const json = JSON.stringify(manifest, null, 2);

                    compilation.emitAsset("manifest.json", new rspack.sources.RawSource(json));
                }
            );
        });
    }

    private collectAllChunks(entryPointOrChunkGroup: any, collectedChunks: Set<Chunk>): Set<Chunk> {
        if (entryPointOrChunkGroup.chunks) {
            entryPointOrChunkGroup.chunks.forEach((chunk: Chunk) => {
                if (!collectedChunks.has(chunk)) {
                    collectedChunks.add(chunk);
                }
            });
        }

        if (entryPointOrChunkGroup.childrenIterable) {
            for (const childGroup of entryPointOrChunkGroup.childrenIterable) {
                this.collectAllChunks(childGroup, collectedChunks);
            }
        }

        return collectedChunks;
    }

    private isAsset(file: string): boolean {
        return /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/.test(file);
    }
}

export default ManifestPlugin;
