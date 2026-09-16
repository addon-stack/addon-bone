import type {Chunk, Configuration as RspackConfig, NormalModule, Plugins} from "@rspack/core";

import ContentManager from "./ContentManager";
import Content from "./Content";
import Relay from "./Relay";
import RelayDeclaration from "./RelayDeclaration";
import {hasIsolatedTarget} from "./utils";
import {createPageAccessRequirements, getContentChunkName} from "./bundler";
import {createRelayModule, RelayModuleName} from "./relay-module";

import {definePlugin} from "@main/plugin";
import {PageFinder} from "@cli/entrypoint";
import {getContentLayer} from "@cli/bundler/layers";

import {
    appFilenameResolver,
    ChunkLoaderPlugin,
    EntrypointPlugin,
    onlyViaTopLevelEntry,
    IsolatedStylesPlugin,
    ResourceAccessPlugin,
    GenerateModulePlugin,
} from "@cli/bundler";

import {Command} from "@typing/app";
import {ContentScriptStylesRuntimeProperty, ContentScriptWorld} from "@typing/content";

export default definePlugin(() => {
    let contentProvider: Content;
    let relayProvider: Relay;
    let contentManager: ContentManager;
    let relayDeclaration: RelayDeclaration;

    return {
        name: "adnbn:content",
        startup: ({config}) => {
            contentProvider = new Content(config);
            relayProvider = new Relay(config);

            // prettier-ignore
            contentManager = new ContentManager(config)
                .provider(contentProvider)
                .provider(relayProvider);

            relayDeclaration = new RelayDeclaration(config);
        },
        content: () => contentProvider.files(),
        relay: () => relayProvider.files(),
        bundler: async ({config}) => {
            relayDeclaration.dictionary(await relayProvider.dictionary()).build();

            let entryOptionsByName = await contentManager.entryOptions();

            const getModules = async () => ({
                [RelayModuleName]: createRelayModule(await relayProvider.getOptionsMap()),
            });

            const modulePlugin = new GenerateModulePlugin(await getModules());

            if (config.command === Command.Watch) {
                modulePlugin.watch(getModules);
            }

            const basePlugins: Plugins = [
                modulePlugin,
                new ResourceAccessPlugin({
                    requirements: async () => {
                        if (
                            !Array.from(entryOptionsByName.values()).some(
                                options => options.isolation?.page !== undefined
                            )
                        ) {
                            return [];
                        }

                        const views = await new PageFinder(config).views();
                        const pages = new Map(Array.from(views.values(), view => [view.alias, view.filename]));

                        return createPageAccessRequirements(entryOptionsByName, pages);
                    },
                }),
            ];

            if (await contentManager.empty()) {
                if (config.debug) {
                    console.warn("Content script or relay entries not found");
                }

                return {plugins: basePlugins};
            }

            const entries = await contentManager.entries();

            const getEntryWorld = (name: string): ContentScriptWorld => {
                const options = entryOptionsByName.get(name);

                if (!options) {
                    throw new Error(`Execution world for content entrypoint "${name}" is unavailable`);
                }

                return options.world === ContentScriptWorld.Main
                    ? ContentScriptWorld.Main
                    : ContentScriptWorld.Isolated;
            };

            // prettier-ignore
            const entrypointPlugin = EntrypointPlugin.from(entries)
                .virtual(file => contentManager.virtual(file))
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
                entrypointPlugin.watch(async () => {
                    contentManager.clear();

                    relayDeclaration.dictionary(await relayProvider.dictionary()).build();

                    const entries = await contentManager.entries();
                    entryOptionsByName = await contentManager.entryOptions();

                    return entries;
                });
            }

            const isContentModule = onlyViaTopLevelEntry(["content", "relay"]);

            const createCacheGroup = (world: ContentScriptWorld) => ({
                minChunks: 2,
                name: getContentChunkName(world),
                test: (
                    module: Parameters<typeof isContentModule>[0],
                    context: Parameters<typeof isContentModule>[1]
                ) => {
                    const normalModule = module as NormalModule;

                    if (!normalModule.resource) {
                        return false;
                    }

                    return isContentModule(module, context);
                },
                chunks: (chunk: Chunk): boolean =>
                    chunk.name !== undefined &&
                    entryOptionsByName.has(chunk.name) &&
                    getEntryWorld(chunk.name) === world,
                enforce: false,
                reuseExistingChunk: false,
                priority: 20,
            });

            return {
                plugins: [
                    entrypointPlugin,
                    new ChunkLoaderPlugin({
                        test: entry =>
                            entryOptionsByName.has(entry) && getEntryWorld(entry) === ContentScriptWorld.Isolated,
                    }),
                    new IsolatedStylesPlugin({
                        cssFilename: appFilenameResolver(config.app, config.cssFilename, config.cssDir),
                        cssChunkFilename: appFilenameResolver(config.app, config.cssFilename, config.cssDir),
                        property: ContentScriptStylesRuntimeProperty,
                        test: entry => {
                            const options = entryOptionsByName.get(entry);

                            return options !== undefined && hasIsolatedTarget(options);
                        },
                    }),
                    ...basePlugins,
                ],
                optimization: config.commonChunks
                    ? {
                          splitChunks: {
                              cacheGroups: {
                                  adnbnContentIsolated: createCacheGroup(ContentScriptWorld.Isolated),
                                  adnbnContentMain: createCacheGroup(ContentScriptWorld.Main),
                              },
                          },
                      }
                    : undefined,
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            // prettier-ignore
            manifest
                .setContentScripts(await contentManager.manifest())
                .appendHostPermissions(await contentManager.hostPermissions())
                .appendOptionalHostPermissions(await contentManager.optionalHostPermissions())
                .appendPermissions(await contentManager.permissions())
                .appendOptionalPermissions(await contentManager.optionalPermissions());
        },
    };
});
