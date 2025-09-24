import {Configuration as RspackConfig, DefinePlugin} from "@rspack/core";
import {merge as mergeConfig} from "webpack-merge";

import ContentManager from "./ContentManager";
import Content from "./Content";
import Relay from "./Relay";
import RelayDeclaration from "./RelayDeclaration";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin, onlyViaTopLevelEntry} from "@cli/bundler";

import {Command} from "@typing/app";
import {RelayMethod, RelayOptions} from "@typing/relay";
import {ContentScriptDeclarative} from "@typing/content";

export default definePlugin(() => {
    let content: Content;
    let relay: Relay;
    let manager: ContentManager;
    let relayDeclaration: RelayDeclaration;

    return {
        name: "adnbn:content",
        startup: async ({config}) => {
            content = new Content(config);
            relay = new Relay(config);

            manager = new ContentManager(config).provider(content).provider(relay);

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

                if (config.command === Command.Watch) {
                    plugin.watch(async () => {
                        manager.clear();

                        relayDeclaration.dictionary(await relay.dictionary()).build();

                        return manager.entries();
                    });
                }

                rspack = {
                    plugins: [plugin],
                    optimization: {
                        splitChunks: {
                            cacheGroups: {
                                frameworkContent: {
                                    minChunks: 2,
                                    name: manager.chunkName(),
                                    test: onlyViaTopLevelEntry(["content", "relay"]),
                                    chunks: (chunk): boolean => {
                                        return manager.likely(chunk.name);
                                    },
                                    enforce: false,
                                    reuseExistingChunk: true,
                                    priority: 10,
                                },
                            },
                        },
                    },
                };
            }

            return mergeConfig(rspack, {
                plugins: [
                    new DefinePlugin({
                        __ADNBN_RELAY_OPTIONS__: JSON.stringify(options),
                    }),
                ],
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
