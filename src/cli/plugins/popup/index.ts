import {Configuration as RspackConfig, DefinePlugin, HtmlRspackPlugin, Plugins} from "@rspack/core";
import HtmlRspackTagsPlugin from "html-rspack-tags-plugin";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin} from "@cli/bundler";
import {virtualViewModule} from "@cli/virtual";

import Popup, {PopupNameToManifest} from "./Popup";

import {PopupDeclaration} from "./declaration";

import {isWatchCommand} from "@typing/app";

export default definePlugin(() => {
    let popup: Popup;
    let declaration: PopupDeclaration;

    return {
        name: "adnbn:popup",
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
                const tagsPlugins = (await popup.view().tags()).map(options => new HtmlRspackTagsPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);
            }

            return {
                plugins: [
                    new DefinePlugin({
                        __ADNBN_POPUP_MAP__: JSON.stringify(alias),
                    }),
                    ...plugins,
                ],
            } as RspackConfig;
        },
        manifest: async ({manifest}) => {
            manifest.setPopup(await popup.manifest()).appendCsp(await popup.csp());
        },
    };
});
