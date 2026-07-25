import {Configuration as RspackConfig, HtmlRspackPlugin, Plugins} from "@rspack/core";
import HtmlTagsRspackPlugin from "@rspackjs/plugin-html-tags";

import Page from "./Page";

import {PageDeclaration} from "./declaration";

import {definePlugin} from "@main/plugin";
import {virtualViewModule} from "@cli/virtual";
import {EntrypointPlugin, VirtualDataPlugin} from "@cli/bundler";
import {ViewAliasToFilename} from "@cli/entrypoint";

import {viewTopology} from "@cli/utils/topology";

import {isWatchCommand} from "@typing/app";

export default definePlugin(() => {
    let page: Page;
    let declaration: PageDeclaration;

    return {
        name: "adnbn:page",
        topology: async () => ((await page.empty()) ? {} : viewTopology(page.view())),
        startup: ({config}) => {
            page = new Page(config);
            declaration = new PageDeclaration(config);
        },
        page: () => page.files(),
        bundler: async ({config}) => {
            declaration.setAlias(await page.getAlias()).build();

            const plugins: Plugins = [];

            let alias: ViewAliasToFilename = new Map();

            if (await page.empty()) {
                if (config.debug) {
                    console.info("Page entries not found");
                }
            } else {
                alias = await page.getAliasToFilename();

                // prettier-ignore
                const plugin = EntrypointPlugin.from(await page.view().entries())
                    .virtual(file => virtualViewModule(file));

                if (isWatchCommand(config.command)) {
                    plugin.watch(async () => {
                        declaration.setAlias(await page.clear().getAlias()).build();

                        return page.view().entries();
                    });
                }

                const htmlPlugins = (await page.view().html()).map(options => new HtmlRspackPlugin(options));
                const tagsPlugins = (await page.view().tags()).map(options => new HtmlTagsRspackPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);
            }

            const data = new VirtualDataPlugin("page", {pages: alias});

            if (isWatchCommand(config.command)) {
                data.watch({
                    update: async () => ({pages: (await page.clear().empty()) ? {} : await page.getAliasToFilename()}),
                });
            }

            return {
                plugins: [data, ...plugins],
                resolve: {alias: data.alias()},
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            manifest.appendAccessibleResources(await page.accessibleResources()).appendCsp(await page.csp());
        },
    };
});
