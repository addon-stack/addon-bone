import {Configuration as RspackConfig, HtmlRspackPlugin, Plugins} from "@rspack/core";
import HtmlTagsRspackPlugin from "@rspackjs/plugin-html-tags";

import {definePlugin} from "@main/plugin";
import {EntrypointPlugin, VirtualDataPlugin} from "@cli/bundler";

import {viewTopology} from "@cli/utils/topology";

import Sandbox, {SandboxParametersMap} from "./Sandbox";
import SandboxDeclaration from "./SandboxDeclaration";

import {isWatchCommand} from "@typing/app";

export default definePlugin(() => {
    let sandbox: Sandbox;
    let declaration: SandboxDeclaration;

    return {
        name: "adnbn:sandbox",
        topology: async () => ((await sandbox.empty()) ? {} : viewTopology(sandbox.view())),
        startup: ({config}) => {
            sandbox = new Sandbox(config);
            declaration = new SandboxDeclaration(config);
        },
        sandbox: () => sandbox.files(),
        bundler: async ({config}) => {
            declaration.dictionary(await sandbox.dictionary()).build();

            let build = true;

            if (await sandbox.empty()) {
                if (config.debug) {
                    console.info("Sandbox entries not found");
                }

                build = false;
            }

            const plugins: Plugins = [];
            let parameters: SandboxParametersMap = {};

            if (build) {
                parameters = await sandbox.parameters();

                const plugin = EntrypointPlugin.from(await sandbox.view().entries()).virtual(file =>
                    sandbox.virtual(file)
                );

                if (isWatchCommand(config.command)) {
                    plugin.watch(async () => {
                        declaration.dictionary(await sandbox.clear().dictionary()).build();

                        return sandbox.view().entries();
                    });
                }

                const htmlPlugins = (await sandbox.view().html()).map(options => new HtmlRspackPlugin(options));
                const tagsPlugins = (await sandbox.view().tags()).map(options => new HtmlTagsRspackPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);
            }

            const data = new VirtualDataPlugin("sandbox", {sandboxes: parameters});

            if (isWatchCommand(config.command)) {
                data.watch({
                    update: async () => {
                        sandbox.clear();

                        return {sandboxes: (await sandbox.empty()) ? {} : await sandbox.parameters()};
                    },
                });
            }

            return {
                plugins: [data, ...plugins],
                resolve: {alias: data.alias()},
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            if (await sandbox.exists()) {
                manifest.appendSandboxes(await sandbox.sandboxes()).appendSandboxCsp(await sandbox.views().csp());
            }
        },
    };
});
