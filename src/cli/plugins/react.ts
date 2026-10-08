import path from "path";
import {Configuration as RspackConfig} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import {getResolvePath} from "@cli/workspace";

export default definePlugin(() => {
    return {
        name: "adnbn:react",
        bundler: () => {
            return {
                resolve: {
                    extensions: [".js", ".jsx"],
                    alias: {
                        react: getResolvePath(path.join("node_modules", "react")),
                        "react-dom": getResolvePath(path.join("node_modules", "react-dom")),
                        scheduler: getResolvePath(path.join("node_modules", "scheduler")),
                    },
                },
                optimization: {
                    splitChunks: {
                        cacheGroups: {
                            react: {
                                name: "react",
                                test: /[\\/]node_modules[\\/](react|react-dom|scheduler)([\\/]|$)/,
                                priority: 100,
                                reuseExistingChunk: true,
                                enforce: true,
                            },
                        },
                    },
                },
                module: {
                    rules: [
                        {
                            test: /\.svg$/i,
                            issuer: /\.[jt]sx?$/,
                            resourceQuery: /react/,
                            use: [
                                {
                                    loader: "@svgr/webpack",
                                    options: {
                                        expandProps: "start",
                                        typescript: true,
                                    },
                                },
                            ],
                        },
                    ],
                },
            } as RspackConfig;
        },
    };
});
