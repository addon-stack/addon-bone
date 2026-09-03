import _ from "lodash";
import {Configuration as RspackConfig} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import {appFilenameResolver, BuildAssetsMapPlugin} from "@cli/bundler";
import {getOutputPath, getResolvePath} from "@cli/resolvers/path";

import {Command} from "@typing/app";
import {BackgroundEntryName} from "@typing/background";

const serializeFilename = (filename: unknown): string => {
    return typeof filename === "function" ? filename.toString() : String(filename ?? "");
};

export default definePlugin(() => {
    return {
        name: "adnbn:output",
        bundler: ({config}) => {
            const {app, assetsDir, assetsFilename, cssDir, cssFilename, jsDir, jsFilename} = config;

            const kebabApp = _.kebabCase(app);
            const camelApp = _.camelCase(app);

            const filename = appFilenameResolver(app, jsFilename, jsDir);
            const cssOutputFilename = appFilenameResolver(app, cssFilename, cssDir);
            const buildHashSalt = JSON.stringify({
                app,
                assetsDir,
                assetsFilename: serializeFilename(assetsFilename),
                cssDir,
                cssFilename: serializeFilename(cssFilename),
                jsDir,
                jsFilename: serializeFilename(jsFilename),
            });

            return {
                output: {
                    path: getResolvePath(getOutputPath(config)),
                    filename,
                    chunkFilename: filename,
                    hashSalt: kebabApp,
                    hotUpdateGlobal: camelApp + "HotUpdate",
                    chunkLoadingGlobal: camelApp + "ChunkLoading",
                    uniqueName: kebabApp,
                    clean: config.command === Command.Build,
                },
                plugins: [
                    new BuildAssetsMapPlugin({
                        buildHashSalt,
                        cssChunkFilename: cssOutputFilename,
                        cssFilename: cssOutputFilename,
                        fullMapEntrypoint: BackgroundEntryName,
                    }),
                ],
            } satisfies RspackConfig;
        },
    };
});
