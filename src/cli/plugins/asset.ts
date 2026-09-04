import {Configuration as RspackConfig} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import {appFilenameResolver, ReplacePlugin} from "@cli/bundler";

import {Browser} from "@typing/browser";

export default definePlugin(() => {
    return {
        name: "adnbn:asset",
        bundler: ({config}) => {
            const {app, browser, assetsDir, assetsFilename} = config;

            return {
                output: {
                    assetModuleFilename: appFilenameResolver(app, assetsFilename, assetsDir),
                },
                module: {
                    rules: [
                        {
                            test: /\.(woff2?|eot|ttf|otf)$/i,
                            type: "asset/resource",
                        },
                        {
                            test: /\.(png|apng|jpe?g|gif|webp|svg|avif|tiff|bmp|ico)$/i,
                            resourceQuery: {
                                not: [/react/],
                            },
                            oneOf: [
                                {
                                    resourceQuery: /(chrome|browser)/,
                                    type: "asset/resource",
                                    generator: {
                                        publicPath: `${browser === Browser.Firefox ? "moz" : "chrome"}-extension://__MSG_@@extension_id__/`,
                                    },
                                },
                                {
                                    resourceQuery: /base64/,
                                    type: "asset/inline",
                                },
                                {
                                    type: "asset/resource",
                                },
                            ],
                        },
                    ],
                },
                plugins: [
                    new ReplacePlugin({
                        // Fix for asset/resource publicPath
                        values: {
                            "__MSG_%40@extension_id__": "__MSG_@@extension_id__",
                        },
                    }),
                ],
            } satisfies RspackConfig;
        },
    };
});
