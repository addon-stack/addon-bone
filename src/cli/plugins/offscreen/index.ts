import path from "path";
import {Configuration as RspackConfig, DefinePlugin, HtmlRspackPlugin, Plugins} from "@rspack/core";
import HtmlRspackTagsPlugin from "html-rspack-tags-plugin";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin, VirtualModuleAdapter} from "@cli/bundler";
import {virtualOffscreenBackgroundModule} from "@cli/virtual";

import Offscreen, {OffscreenParameters} from "./Offscreen";
import OffscreenDeclaration from "./OffscreenDeclaration";

import {isWatchCommand} from "@typing/app";
import {Browser} from "@typing/browser";
import {BackgroundEntryName} from "@typing/background";

const OffscreenVirtualDir = "virtual";
const OffscreenBackgroundModule = "offscreen.background.ts";

export default definePlugin(() => {
    let offscreen: Offscreen;
    let declaration: OffscreenDeclaration;

    return {
        name: "adnbn:offscreen",
        startup: ({config}) => {
            offscreen = new Offscreen(config);
            declaration = new OffscreenDeclaration(config);
        },
        offscreen: () => offscreen.files(),
        bundler: async ({config}) => {
            declaration.dictionary(await offscreen.dictionary()).build();

            let build: boolean = true;
            let rspack: RspackConfig = {};

            if (await offscreen.empty()) {
                if (config.debug) {
                    console.info("Offscreen entries not found");
                }

                build = false;
            }

            const plugins: Plugins = [];

            let parameters: OffscreenParameters = {};

            if (build) {
                parameters = await offscreen.parameters();

                // prettier-ignore
                const plugin = EntrypointPlugin.from(await offscreen.view().entries())
                    .virtual(file => offscreen.virtual(file));

                if (isWatchCommand(config.command)) {
                    plugin.watch(async () => {
                        declaration.dictionary(await offscreen.clear().dictionary()).build();

                        return offscreen.view().entries();
                    });
                }

                const htmlPlugins = (await offscreen.view().html()).map(options => new HtmlRspackPlugin(options));
                const tagsPlugins = (await offscreen.view().tags()).map(options => new HtmlRspackTagsPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);

                if (config.manifestVersion === 2 || config.browser === Browser.Firefox) {
                    const offscreenBackgroundPath = path.join(OffscreenVirtualDir, OffscreenBackgroundModule);

                    const virtualPlugin = new VirtualModuleAdapter({
                        [offscreenBackgroundPath]: virtualOffscreenBackgroundModule(),
                    });

                    plugins.push(virtualPlugin);

                    rspack = {
                        entry: {
                            [BackgroundEntryName]: {
                                import: [virtualPlugin.entryRequest(offscreenBackgroundPath)],
                            },
                        },
                    };
                }
            }

            return {
                ...rspack,
                plugins: [
                    new DefinePlugin({
                        __ADNBN_OFFSCREEN_PARAMETERS__: JSON.stringify(parameters),
                    }),
                    ...plugins,
                ],
            } satisfies RspackConfig;
        },
        manifest: async ({manifest, config}) => {
            manifest.appendCsp(await offscreen.views().csp());

            if (config.manifestVersion !== 2 && config.browser !== Browser.Firefox && (await offscreen.exists())) {
                manifest.addPermission("offscreen");
            }
        },
    };
});
