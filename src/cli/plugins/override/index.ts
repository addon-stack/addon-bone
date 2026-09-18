import {Configuration as RspackConfig, HtmlRspackPlugin} from "@rspack/core";
import HtmlRspackTagsPlugin from "html-rspack-tags-plugin";

import Override from "./Override";

import {definePlugin} from "@main/plugin";
import {EntrypointPlugin} from "@cli/bundler";
import {virtualViewModule} from "@cli/virtual";

import {Command} from "@typing/app";
import {EntrypointType} from "@typing/entrypoint";

export default definePlugin(() => {
    let override: Override;

    return {
        name: "adnbn:override",
        startup: ({config}) => {
            override = new Override(config);
        },
        newtab: () => override.files(EntrypointType.Newtab),
        bookmarks: () => override.files(EntrypointType.Bookmarks),
        history: () => override.files(EntrypointType.History),
        bundler: async ({config}) => {
            const view = await override.view();

            if (!view) {
                if (config.debug) {
                    console.info("Override entry not found");
                }

                return {};
            }

            const plugin = EntrypointPlugin.from(await view.entries()).virtual(virtualViewModule);

            if (config.command === Command.Watch) {
                plugin.watch(async () => (await override.clear().view())?.entries() ?? new Map());
            }

            const htmlPlugins = (await view.html()).map(options => new HtmlRspackPlugin(options));
            const tagsPlugins = (await view.tags()).map(options => new HtmlRspackTagsPlugin(options));

            return {
                plugins: [plugin, ...htmlPlugins, ...tagsPlugins],
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            const {permissions, optionalPermissions, hostPermissions, optionalHostPermissions} =
                await override.permissions();

            manifest
                .setOverride(await override.manifest())
                .appendCsp(await override.csp())
                .appendPermissions(permissions)
                .appendOptionalPermissions(optionalPermissions)
                .appendHostPermissions(hostPermissions)
                .appendOptionalHostPermissions(optionalHostPermissions);
        },
    };
});
