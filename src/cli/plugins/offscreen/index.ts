import {Configuration as RspackConfig, HtmlRspackPlugin, Plugins} from "@rspack/core";
import {RspackVirtualModulePlugin} from "rspack-plugin-virtual-module";
import HtmlTagsRspackPlugin from "@rspackjs/plugin-html-tags";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin, GenerateModulePlugin} from "@cli/bundler";
import {virtualOffscreenBackgroundModule} from "@cli/virtual";

import Offscreen from "./Offscreen";
import OffscreenDeclaration from "./OffscreenDeclaration";
import {createOffscreenModule, OffscreenModuleName} from "./offscreen-module";

import {Command} from "@typing/app";
import {Browser} from "@typing/browser";
import {BackgroundEntryName} from "@typing/background";
import type {OffscreenParametersMap} from "@typing/offscreen";

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

            let parameters: OffscreenParametersMap = {};

            if (build) {
                parameters = await offscreen.parameters();

                // prettier-ignore
                const plugin = EntrypointPlugin.from(await offscreen.view().entries())
                    .virtual(file => offscreen.virtual(file));

                if (config.command === Command.Watch) {
                    plugin.watch(async () => {
                        declaration.dictionary(await offscreen.clear().dictionary()).build();

                        return offscreen.view().entries();
                    });
                }

                const htmlPlugins = (await offscreen.view().html()).map(options => new HtmlRspackPlugin(options));
                const tagsPlugins = (await offscreen.view().tags()).map(options => new HtmlTagsRspackPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);

                if (config.manifestVersion === 2 || config.browser === Browser.Firefox) {
                    plugins.push(
                        new RspackVirtualModulePlugin(
                            {
                                [OffscreenBackgroundModule]: virtualOffscreenBackgroundModule(),
                            },
                            "virtual"
                        )
                    );

                    rspack = {
                        entry: {
                            [BackgroundEntryName]: {
                                import: [OffscreenBackgroundModule],
                            },
                        },
                    };
                }
            }

            return {
                ...rspack,
                plugins: [
                    new GenerateModulePlugin({
                        [OffscreenModuleName]: createOffscreenModule(parameters),
                    }),
                    ...plugins,
                ],
            } satisfies RspackConfig;
        },
        manifest: async ({manifest, config}) => {
            const views = offscreen.views();

            manifest
                .appendCsp(await views.csp())
                .appendPermissions(await views.permissions())
                .appendOptionalPermissions(await views.optionalPermissions())
                .appendHostPermissions(await views.hostPermissions())
                .appendOptionalHostPermissions(await views.optionalHostPermissions());

            if (config.manifestVersion !== 2 && config.browser !== Browser.Firefox && (await offscreen.exists())) {
                manifest.addPermission("offscreen");
            }
        },
    };
});
