import {Chunk, Configuration as RspackConfig, DefinePlugin, NormalModule} from "@rspack/core";
import {merge as mergeConfig} from "webpack-merge";

import ContentManager from "./ContentManager";
import Content from "./Content";
import Relay from "./Relay";
import RelayDeclaration from "./RelayDeclaration";
import {getContentChunkName, getContentLayer} from "./utils";

import {definePlugin} from "@main/plugin";

import {ChunkLoaderPlugin, EntrypointPlugin, onlyViaTopLevelEntry} from "@cli/bundler";

import {Command} from "@typing/app";
import {ContentScriptWorld} from "@typing/content";
import {RelayOptions} from "@typing/relay";

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

                const entries = await manager.entries();
                let entryWorlds = await manager.entryWorlds();
                const getEntryWorld = (name: string): ContentScriptWorld => {
                    const world = entryWorlds.get(name);

                    if (!world) {
                        throw new Error(`Execution world for content entrypoint "${name}" is unavailable`);
                    }

                    return world;
                };

                // prettier-ignore
                const plugin = EntrypointPlugin.from(entries)
                    .virtual(file => manager.virtual(file))
                    .entryOptions(name => {
                        const world = getEntryWorld(name);

                        return {
                            // MAIN cannot resolve an installed extension URL without crossing contexts.
                            // ISOLATED keeps physical async chunks and resolves them through the extension API.
                            asyncChunks: world === ContentScriptWorld.Isolated,
                            layer: getContentLayer(world),
                            publicPath: "",
                        };
                    });

                if (config.command === Command.Watch) {
                    plugin.watch(async () => {
                        manager.clear();

                        relayDeclaration.dictionary(await relay.dictionary()).build();

                        const entries = await manager.entries();
                        entryWorlds = await manager.entryWorlds();

                        return entries;
                    });
                }

                const entryTypeFilter = onlyViaTopLevelEntry(["content", "relay"]);

                const contentCacheGroup = (world: ContentScriptWorld) => ({
                    minChunks: 2,
                    name: getContentChunkName(world),
                    test: (
                        module: Parameters<typeof entryTypeFilter>[0],
                        context: Parameters<typeof entryTypeFilter>[1]
                    ) => {
                        const normalModule = module as NormalModule;

                        if (!normalModule.resource) {
                            return false;
                        }

                        return entryTypeFilter(module, context);
                    },
                    chunks: (chunk: Chunk): boolean =>
                        chunk.name !== undefined && entryWorlds.get(chunk.name) === world,
                    enforce: false,
                    reuseExistingChunk: false,
                    priority: 20,
                });

                rspack = {
                    plugins: [
                        plugin,
                        new ChunkLoaderPlugin({
                            test: entry => entryWorlds.get(entry) === ContentScriptWorld.Isolated,
                        }),
                    ],
                    optimization: config.commonChunks
                        ? {
                              splitChunks: {
                                  cacheGroups: {
                                      adnbnContentIsolated: contentCacheGroup(ContentScriptWorld.Isolated),
                                      adnbnContentMain: contentCacheGroup(ContentScriptWorld.Main),
                                  },
                              },
                          }
                        : undefined,
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
                .appendOptionalHostPermissions(await manager.optionalHostPermissions())
                .appendPermissions(await manager.permissions())
                .appendOptionalPermissions(await manager.optionalPermissions());
        },
    };
});
