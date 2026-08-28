import _ from "lodash";
import {Configuration as RspackConfig, NormalModule} from "@rspack/core";
import {merge as mergeConfig} from "webpack-merge";

import {definePlugin} from "@main/plugin";

import {resolveRootPath} from "@cli/resolvers/path";

export default definePlugin(() => {
    return {
        name: "adnbn:optimization",
        bundler: ({config}) => {
            const rspack: RspackConfig = {
                optimization: {
                    moduleIds: "deterministic",
                    chunkIds: "deterministic",
                    mangleExports: "deterministic",
                    usedExports: true,
                    providedExports: true,
                },
            };

            const {commonChunks} = config;

            if (!commonChunks) {
                return rspack;
            }

            return mergeConfig(rspack, {
                optimization: {
                    splitChunks: {
                        chunks: "all",
                        minSize: 20000,
                        cacheGroups: {
                            default: false,
                            defaultVendors: false,
                            adnbnCommon: {
                                test: module => {
                                    const {resource} = module as NormalModule;

                                    if (!resource) {
                                        return false;
                                    }

                                    if (/[\\/]node_modules[\\/]/.test(resource)) {
                                        return true;
                                    }

                                    if (resource.startsWith(resolveRootPath(config))) {
                                        return true;
                                    }

                                    const isFileSystemModule = resource.includes("/") || resource.includes("\\");
                                    const isVirtual = resource.startsWith("virtual:") || resource.startsWith("\0");

                                    return isFileSystemModule && !isVirtual;
                                },
                                name: (_module, chunks) => {
                                    const names = new Set(
                                        chunks
                                            .map(({name}) => name)
                                            .filter((name): name is string => _.isString(name) && !_.isEmpty(name))
                                    );

                                    if (_.isFunction(commonChunks)) {
                                        const name = commonChunks(names);

                                        if (_.isString(name) && !_.isEmpty(name)) {
                                            return name;
                                        }
                                    }

                                    if (names.size === 0) {
                                        return `async.common`;
                                    }

                                    const sortedNames = Array.from(names).toSorted();
                                    const joinedNames = sortedNames.join("-");

                                    if (joinedNames.length <= 60 && sortedNames.length <= 3) {
                                        return `${joinedNames}.common`;
                                    }

                                    let hash = 0;

                                    for (let i = 0; i < joinedNames.length; i++) {
                                        hash = (hash << 5) - hash + joinedNames.charCodeAt(i);
                                        hash |= 0;
                                    }

                                    const hashStr = Math.abs(hash).toString(36).slice(0, 8);
                                    const prefix = sortedNames.slice(0, 2).join("-");

                                    return `${prefix}-etc-${hashStr}.common`;
                                },
                                minChunks: 2,
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
