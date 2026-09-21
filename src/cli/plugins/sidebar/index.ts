import {Configuration as RspackConfig, HtmlRspackPlugin, Plugins} from "@rspack/core";
import HtmlRspackTagsPlugin from "html-rspack-tags-plugin";

import {definePlugin} from "@main/plugin";

import {EntrypointPlugin, GenerateModulePlugin} from "@cli/bundler";
import {virtualViewModule} from "@cli/virtual";

import Sidebar, {SidebarNameToManifest} from "./Sidebar";
import {createSidebarModule, SidebarModuleName} from "./sidebar-module";

import {SidebarDeclaration} from "./declaration";

import {Command} from "@typing/app";
import {SidebarAlternativeBrowsers} from "@typing/sidebar";

export default definePlugin(() => {
    let sidebar: Sidebar;
    let declaration: SidebarDeclaration;

    let sidebarAvailable: boolean = false;

    return {
        name: "adnbn:sidebar",
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

            let alias: SidebarNameToManifest = {};

            if (build) {
                alias = await sidebar.manifestByAlias();

                // prettier-ignore
                const plugin = EntrypointPlugin.from(await sidebar.view().entries())
                    .virtual(file => virtualViewModule(file));

                if (config.command === Command.Watch) {
                    plugin.watch(async () => {
                        declaration.setAlias(await sidebar.clear().getAlias()).build();

                        return sidebar.view().entries();
                    });
                }

                const htmlPlugins = (await sidebar.view().html()).map(options => new HtmlRspackPlugin(options));
                const tagsPlugins = (await sidebar.view().tags()).map(options => new HtmlRspackTagsPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);
            }

            return {
                plugins: [
                    new GenerateModulePlugin({
                        [SidebarModuleName]: createSidebarModule(alias),
                    }),
                    ...plugins,
                ],
            } as RspackConfig;
        },
        manifest: async ({manifest, config}) => {
            if (!sidebarAvailable) {
                return;
            }

            // Every built sidebar can be switched to at runtime, so all of them contribute their permissions.
            manifest
                .setSidebar(await sidebar.manifest())
                .appendCsp(await sidebar.csp())
                .appendPermissions(await sidebar.permissions())
                .appendOptionalPermissions(await sidebar.optionalPermissions())
                .appendHostPermissions(await sidebar.hostPermissions())
                .appendOptionalHostPermissions(await sidebar.optionalHostPermissions());

            if ((await sidebar.exists()) && !SidebarAlternativeBrowsers.has(config.browser)) {
                manifest.addPermission("sidePanel");
            }
        },
    };
});
