import {Configuration as RspackConfig, DefinePlugin, HtmlRspackPlugin, Plugins} from "@rspack/core";
import HtmlTagsRspackPlugin from "@rspackjs/plugin-html-tags";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin} from "@cli/bundler";
import {virtualViewModule} from "@cli/virtual";

import {defineTopology, viewTopology} from "@cli/utils/topology";

import Sidebar, {SidebarNameToManifest} from "./Sidebar";

import {SidebarDeclaration} from "./declaration";

import {isWatchCommand} from "@typing/app";
import {SidebarAlternativeBrowsers} from "@typing/sidebar";

export default definePlugin(() => {
    let sidebar: Sidebar;
    let declaration: SidebarDeclaration;

    let sidebarAvailable: boolean = false;

    return {
        name: "adnbn:sidebar",
        topology: async () => {
            const build = !(await sidebar.empty()) && sidebarAvailable;
            const defines = [
                defineTopology({name: "__ADNBN_SIDEBAR_MAP__", value: build ? await sidebar.manifestByAlias() : {}}),
            ];

            return build ? viewTopology(sidebar.view(), defines) : {defines};
        },
        startup: ({config}) => {
            sidebar = new Sidebar(config);
            declaration = new SidebarDeclaration(config);

            sidebarAvailable = SidebarAlternativeBrowsers.has(config.browser) || config.manifestVersion !== 2;
        },
        sidebar: () => sidebar.files(),
        bundler: async ({config}) => {
            declaration.setAlias(await sidebar.getAlias()).build();

            let build: boolean = true;

            if (await sidebar.empty()) {
                if (config.debug) {
                    console.info("Sidebar entries not found");
                }

                build = false;
            } else if (!sidebarAvailable) {
                if (config.debug) {
                    console.warn("Sidebar not supported for manifest version 2");
                }

                build = false;
            }

            const plugins: Plugins = [];

            let alias: SidebarNameToManifest = new Map();

            if (build) {
                alias = await sidebar.manifestByAlias();

                // prettier-ignore
                const plugin = EntrypointPlugin.from(await sidebar.view().entries())
                    .virtual(file => virtualViewModule(file));

                if (isWatchCommand(config.command)) {
                    plugin.watch(async () => {
                        declaration.setAlias(await sidebar.clear().getAlias()).build();

                        return sidebar.view().entries();
                    });
                }

                const htmlPlugins = (await sidebar.view().html()).map(options => new HtmlRspackPlugin(options));
                const tagsPlugins = (await sidebar.view().tags()).map(options => new HtmlTagsRspackPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);
            }

            return {
                plugins: [
                    new DefinePlugin({
                        __ADNBN_SIDEBAR_MAP__: JSON.stringify(alias),
                    }),
                    ...plugins,
                ],
            } as RspackConfig;
        },
        manifest: async ({manifest, config}) => {
            if (!sidebarAvailable) {
                return;
            }

            manifest.setSidebar(await sidebar.manifest());
            manifest.appendCsp(await sidebar.csp());

            if ((await sidebar.exists()) && !SidebarAlternativeBrowsers.has(config.browser)) {
                manifest.addPermission("sidePanel");
            }
        },
    };
});
