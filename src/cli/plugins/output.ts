import _ from "lodash";
import {Configuration as RspackConfig, DefinePlugin} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import {appFilenameResolver, EntrypointMetaPlugin} from "@cli/bundler";
import {getOutputPath, getResolvePath} from "@cli/resolvers/path";

import {Command} from "@typing/app";

export default definePlugin(() => {
    return {
        name: "adnbn:output",
        bundler: ({config}) => {
            const {app, jsDir, jsFilename} = config;

            const kebabApp = _.kebabCase(app);
            const camelApp = _.camelCase(app);

            const filename = appFilenameResolver(app, jsFilename, jsDir);

            return {
                output: {
                    path: getResolvePath(getOutputPath(config)),
                    filename,
                    chunkFilename: filename,
                    hotUpdateGlobal: camelApp + "HotUpdate",
                    chunkLoadingGlobal: camelApp + "ChunkLoading",
                    uniqueName: kebabApp,
                    clean: config.command === Command.Build,
                },
                plugins: [
                    new DefinePlugin({
                        __ENTRYPOINT_META__: "(0, \"__ADNBN_EM__META__\")",
                        __ENTRYPOINT_NAME__: "(0, \"__ADNBN_EM__NAME__\")",
                    }),
                    new EntrypointMetaPlugin()
                ],
            } satisfies RspackConfig;
        },
    };
});
