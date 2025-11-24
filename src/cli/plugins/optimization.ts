import _ from "lodash";
import {Configuration as RspackConfig, NormalModule} from "@rspack/core";
import {merge as mergeConfig} from "webpack-merge";

import {definePlugin} from "@main/plugin";

import {getResolvePath, getSourcePath} from "@cli/resolvers/path";

export default definePlugin(() => {
    return {
        name: "adnbn:optimization",
        bundler: ({config}) => {
            const rspack: RspackConfig = {
                optimization: {
                    moduleIds: "deterministic",
                    chunkIds: "deterministic",
                    mangleExports: "deterministic",
                },
            };

            if (!config.commonChunks) {
                return rspack;
            }

            return mergeConfig(rspack, {
                optimization: {
                    usedExports: true,
                    providedExports: true,
                    splitChunks: {
                        chunks: "all",
                        minSize: 20000,
                        cacheGroups: {
                            default: false,
                            defaultVendors: false,
                            common: {
                                test: module => {
                                    const {resource} = module as NormalModule;

                                    if (!resource) {
                                        return false;
                                    }

                                    return resource.startsWith(getResolvePath(getSourcePath(config)));
                                },
                                name: (module, chunks, cacheGroupKey) => {
                                    const entryNames = Array.from(
                                        new Set(chunks.map(({name}) => name).filter(name => _.isString(name)))
                                    ).sort();

                                    return `${entryNames.join("-")}.${cacheGroupKey}`;
                                },
                                minChunks: 2,
                                enforce: true,
                                priority: -10,
                                reuseExistingChunk: true,
                            },
                        },
                    },
                },
            });
        },
    };
});
