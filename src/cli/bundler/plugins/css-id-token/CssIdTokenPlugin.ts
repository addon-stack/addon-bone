import {Compilation, type Compiler, sources} from "@rspack/core";

import {CssExtensionIdToken} from "./token";

const PluginName = "CssIdTokenPlugin";
const EncodedToken = CssExtensionIdToken.replace("@", "%40");

export default class CssIdTokenPlugin {
    apply(compiler: Compiler): void {
        compiler.hooks.thisCompilation.tap(PluginName, compilation => {
            compilation.hooks.processAssets.tap(
                {
                    name: PluginName,
                    // Restore the token before extracting source maps and computing final content hashes.
                    stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
                },
                () => {
                    for (const asset of compilation.getAssets()) {
                        if (!asset.name.endsWith(".css")) {
                            continue;
                        }

                        const content = asset.source.source().toString();
                        let index = content.indexOf(EncodedToken);

                        if (index === -1) {
                            continue;
                        }

                        // css-loader's new URL() treats the first @ as userinfo and percent-encodes it.
                        const source = new sources.ReplaceSource(asset.source);

                        while (index !== -1) {
                            source.replace(index, index + EncodedToken.length - 1, CssExtensionIdToken);
                            index = content.indexOf(EncodedToken, index + EncodedToken.length);
                        }

                        compilation.updateAsset(asset.name, source);
                    }
                }
            );
        });
    }
}
