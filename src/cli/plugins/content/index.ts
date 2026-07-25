import {Configuration as RspackConfig, NormalModule} from "@rspack/core";
import {merge as mergeConfig} from "webpack-merge";

import ContentManager from "./ContentManager";
import Content from "./Content";
import Relay from "./Relay";
import RelayDeclaration from "./RelayDeclaration";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin, VirtualDataPlugin, onlyViaTopLevelEntry} from "@cli/bundler";
import {getResolvePath, getSourcePath} from "@cli/resolvers/path";

import {entrypointTopology} from "@cli/utils/topology";

import {isWatchCommand} from "@typing/app";
import {RelayMethod, RelayOptions} from "@typing/relay";
import {ContentScriptDeclarative} from "@typing/content";

export default definePlugin(() => {
    let content: Content;
    let relay: Relay;
    let manager: ContentManager;
    let relayDeclaration: RelayDeclaration;

    return {
        name: "adnbn:content",
        topology: async () => ((await manager.empty()) ? {} : entrypointTopology(await manager.entries())),
        startup: async ({config}) => {
            content = new Content(config);
            relay = new Relay(config);

            // prettier-ignore
            manager = new ContentManager(config)
                .provider(content)
                .provider(relay);

            relayDeclaration = new RelayDeclaration(config);
        },
        content: () => content.files(),
        relay: () => relay.files(),
        bundler: async ({config}) => {
            relayDeclaration.dictionary(await relay.dictionary()).build();

            let rspack: RspackConfig = {};
            let options: Record<string, RelayOptions> = {};

            if (await manager.empty()) {
                if (config.debug) {
                    console.warn("Content script or relay entries not found");
                }
            } else {
                options = await relay.getOptionsMap();

                // prettier-ignore
                const plugin = EntrypointPlugin.from(await manager.entries())
                    .virtual(file => manager.virtual(file));

                if (isWatchCommand(config.command)) {
                    plugin.watch(async () => {
                        manager.clear();

                        relayDeclaration.dictionary(await relay.dictionary()).build();

                        return manager.entries();
                    });
                }

                const entryTypeFilter = onlyViaTopLevelEntry(["content", "relay"]);

                rspack = {
                    plugins: [plugin],
                    optimization: {
                        splitChunks: {
                            cacheGroups: {
                                adnbnContent: {
                                    minChunks: 2,
                                    name: manager.chunkName(),
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
                                    chunks: (chunk): boolean => {
                                        return manager.likely(chunk.name);
                                    },
                                    enforce: false,
                                    reuseExistingChunk: true,
                                    priority: 20,
                                },
                            },
                        },
                    },
                };
            }

            const data = new VirtualDataPlugin("relay", {relays: options});

            if (isWatchCommand(config.command)) {
                data.watch({
                    update: async () => {
                        manager.clear();

                        return {relays: (await manager.empty()) ? {} : await relay.getOptionsMap()};
                    },
                });
            }

            return mergeConfig(rspack, {
                plugins: [data],
                resolve: {alias: data.alias()},
            });
        },
        manifest: async ({manifest}) => {
            // prettier-ignore
            manifest
                .setContentScripts(await manager.manifest())
                .appendHostPermissions(await manager.hostPermissions())
                .appendOptionalHostPermissions(await manager.optionalHostPermissions());

            if ((await relay.exists()) && (await relay.hasMethod(RelayMethod.Scripting))) {
                if (await relay.hasDeclarative(ContentScriptDeclarative.Required)) {
                    manifest.addPermission("scripting");
                } else if (await relay.hasDeclarative(ContentScriptDeclarative.Optional)) {
                    manifest.addOptionalPermission("scripting");
                }
            }
        },
    };
});
