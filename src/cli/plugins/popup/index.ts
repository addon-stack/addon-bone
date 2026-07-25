import {Configuration as RspackConfig, HtmlRspackPlugin, Plugins} from "@rspack/core";
import HtmlTagsRspackPlugin from "@rspackjs/plugin-html-tags";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin, VirtualDataPlugin} from "@cli/bundler";
import {virtualViewModule} from "@cli/virtual";

import {viewTopology} from "@cli/utils/topology";

import Popup, {PopupNameToManifest} from "./Popup";

import {PopupDeclaration} from "./declaration";

import {isWatchCommand} from "@typing/app";

export default definePlugin(() => {
    let popup: Popup;
    let declaration: PopupDeclaration;

    return {
        name: "adnbn:popup",
        topology: async () => ((await popup.empty()) ? {} : viewTopology(popup.view())),
        startup: ({config}) => {
            popup = new Popup(config);
            declaration = new PopupDeclaration(config);
        },
        popup: () => popup.files(),
        bundler: async ({config}) => {
            declaration.setAlias(await popup.getAlias()).build();

            const plugins: Plugins = [];

            let alias: PopupNameToManifest = new Map();

            if (await popup.empty()) {
                if (config.debug) {
                    console.info("Popup entries not found");
                }
            } else {
                alias = await popup.manifestByAlias();

                // prettier-ignore
                const plugin = EntrypointPlugin.from(await popup.view().entries())
                    .virtual(file => virtualViewModule(file));

                if (isWatchCommand(config.command)) {
                    plugin.watch(async () => {
                        declaration.setAlias(await popup.clear().getAlias()).build();

                        return popup.view().entries();
                    });
                }

                const htmlPlugins = (await popup.view().html()).map(options => new HtmlRspackPlugin(options));
                const tagsPlugins = (await popup.view().tags()).map(options => new HtmlTagsRspackPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);
            }

            const data = new VirtualDataPlugin("popup", {popups: alias});

            if (isWatchCommand(config.command)) {
                data.watch({
                    update: async () => ({popups: (await popup.clear().empty()) ? {} : await popup.manifestByAlias()}),
                });
            }

            return {
                plugins: [data, ...plugins],
                resolve: {alias: data.alias()},
            } as RspackConfig;
        },
        manifest: async ({manifest}) => {
            manifest.setPopup(await popup.manifest()).appendCsp(await popup.csp());
        },
    };
});
