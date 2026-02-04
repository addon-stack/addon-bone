import {NormalModule} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import {onlyViaTopLevelEntry} from "@cli/bundler";
import {getResolvePath, getSourcePath} from "@cli/resolvers/path";

export {default as View} from "./View";

export default definePlugin(() => {
    return {
        name: "adnbn:view",
        bundler: ({config}) => {
            const entryTypeFilter = onlyViaTopLevelEntry(["page", "popup", "sidebar", "offscreen"]);

            return {
                optimization: {
                    splitChunks: {
                        cacheGroups: {
                            adnbnView: {
                                minChunks: 2,
                                minSize: 0,
                                name: "common.view",
                                test: (module, context) => {
                                    const nm = module as NormalModule;

                                    if (!nm.resource) {
                                        return false;
                                    }

                                    if (nm.resource.startsWith(getResolvePath(getSourcePath(config)))) {
                                        return false;
                                    }

                                    return entryTypeFilter(module, context);
                                },
                                enforce: false,
                                reuseExistingChunk: true,
                                priority: 50,
                            },
                        },
                    },
                },
            };
        },
    };
});
