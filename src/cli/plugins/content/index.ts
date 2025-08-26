import {Configuration as RspackConfig, DefinePlugin, Plugins} from "@rspack/core";

import ContentManager from "./ContentManager";
import Content from "./Content";
import Relay from "./Relay";
import RelayDeclaration from "./RelayDeclaration";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin, onlyViaTopLevelEntry} from "@cli/bundler";

import {Command} from "@typing/app";
import {RelayMethod} from "@typing/relay";

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

            const plugins: Plugins = [];
            let build: boolean = true;
            let rspack: RspackConfig = {};
            let relayMethodsMap: Record<string, RelayMethod> = {};

            if (await manager.empty()) {
                if (config.debug) {
                    console.warn("Content script or relay entries not found");
                }

                build = false;
            }

            if (build) {
                relayMethodsMap = await relay.getMethodsMap();

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

                plugins.push(plugin);

                rspack = {
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

            return {
                ...rspack,
                plugins: [
                    new DefinePlugin({
                        __ADNBN_RELAY_METHODS__: JSON.stringify(relayMethodsMap),
                    }),
                    ...plugins
                ],
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            // prettier-ignore
            manifest
                .setContentScripts(await manager.manifest())
                .appendHostPermissions(await manager.hostPermissions());

            if (await relay.exists() && await relay.hasMethod(RelayMethod.Scripting)) {
                // prettier-ignore
                manifest
                    .addPermission("scripting")
                    .addPermission("tabs");
            }
        },
    };
});
