import {Configuration as RspackConfig} from "@rspack/core";

import ContentManager from "./ContentManager";
import Content from "./Content";
import Relay from "./Relay";
import RelayDeclaration from "./RelayDeclaration";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin, isEntryModuleOrIssuer} from "@cli/bundler";

import {Command} from "@typing/app";

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

            if (await manager.empty()) {
                if (config.debug) {
                    console.warn("Content script or relay entries not found");
                }

                return {};
            }

            const plugin = EntrypointPlugin.from(await manager.entries()).virtual(file => manager.virtual(file));

            if (config.command === Command.Watch) {
                plugin.watch(async () => {
                    manager.clear();

                    relayDeclaration.dictionary(await relay.dictionary()).build();

                    return manager.entries();
                });
            }

            return {
                plugins: [plugin],
                optimization: {
                    splitChunks: {
                        cacheGroups: {
                            frameworkContent: {
                                minChunks: 2,
                                name: manager.chunkName(),
                                test: isEntryModuleOrIssuer(["content", "relay"]),
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
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            // prettier-ignore
            manifest
                .setContentScripts(await manager.manifest())
                .appendHostPermissions(await manager.hostPermissions());

            if (await relay.exists()) {
                // prettier-ignore
                manifest
                    .addPermission("scripting")
                    .addPermission("tabs");
            }
        },
    };
});
