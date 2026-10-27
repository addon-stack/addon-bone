import path from "path";
import {createRequire} from "module";
import {Configuration as RspackConfig} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import {resolveRootPath} from "@cli/workspace";

export default definePlugin(() => {
    return {
        name: "adnbn:react",
        bundler: ({config}) => {
            const projectRequire = createRequire(path.join(resolveRootPath(config), "package.json"));
            const alias: Record<string, string> = {};

            for (const dependency of ["react", "react-dom", "scheduler"]) {
                // Scheduler belongs to react-dom and may be installed in its own node_modules.
                const dependencyRequire =
                    dependency === "scheduler" && alias["react-dom"]
                        ? createRequire(path.join(alias["react-dom"], "package.json"))
                        : projectRequire;

                try {
                    alias[dependency] = path.dirname(dependencyRequire.resolve(`${dependency}/package.json`));
                } catch (error) {
                    // React is optional; unused dependencies must not prevent vanilla builds.
                    if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") {
                        throw error;
                    }
                }
            }

            return {
                resolve: {
                    extensions: [".js", ".jsx"],
                    alias,
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
