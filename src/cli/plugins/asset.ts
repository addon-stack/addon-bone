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
                            // Common binary resources work without a query. An explicit asset
                            // query also supports less common file formats, without hijacking code.
                            test: (file: string) =>
                                !/\.(?:[cm]?[jt]sx?|json|css|s[ac]ss|less|styl|vue|svelte)$/i.test(file),
                            resourceQuery: {
                                not: [/[?&]react(?:[=&]|$)/, /[?&]raw(?:[=&]|$)/],
                            },
                            oneOf: [
                                {
                                    resourceQuery: /[?&](chrome|browser)(?:[=&]|$)/,
                                    type: "asset/resource",
                                    // Both queries explicitly opt into an extension URL. Native CSS
                                    // localization substitutes the installed extension ID/UUID on load.
                                    generator: {
                                        publicPath: `${browser === Browser.Firefox ? "moz" : "chrome"}-extension://__MSG_@@extension_id__/`,
                                    },
                                },
                                {
                                    resourceQuery: /[?&]base64(?:[=&]|$)/,
                                    type: "asset/inline",
                                },
                                {
                                    test: /\.(png|apng|jpe?g|gif|webp|svg|avif|tiff|bmp|ico|woff2?|eot|ttf|otf|mp3|wav|ogg|oga|opus|flac|aac|m4a|mp4|webm|ogv|mov|pdf|zip|gz|wasm)$/i,
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
