import {Configuration as RspackConfig, HtmlRspackPlugin, Plugins} from "@rspack/core";
import HtmlRspackTagsPlugin from "html-rspack-tags-plugin";

import {definePlugin} from "@main/plugin";
import {EntrypointPlugin, GenerateModulePlugin} from "@cli/bundler";

import Sandbox from "./Sandbox";
import SandboxDeclaration from "./SandboxDeclaration";
import {createSandboxModule, SandboxModuleName} from "./sandbox-module";

import {Command} from "@typing/app";
import type {SandboxParametersMap} from "@typing/sandbox";

export default definePlugin(() => {
    let sandbox: Sandbox;
    let declaration: SandboxDeclaration;

    return {
        name: "adnbn:sandbox",
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

                if (config.command === Command.Watch) {
                    plugin.watch(async () => {
                        declaration.dictionary(await sandbox.clear().dictionary()).build();

                        return sandbox.view().entries();
                    });
                }

                const htmlPlugins = (await sandbox.view().html()).map(options => new HtmlRspackPlugin(options));
                const tagsPlugins = (await sandbox.view().tags()).map(options => new HtmlRspackTagsPlugin(options));

                plugins.push(plugin, ...htmlPlugins, ...tagsPlugins);
            }

            return {
                plugins: [
                    new GenerateModulePlugin({
                        [SandboxModuleName]: createSandboxModule(parameters),
                    }),
                    ...plugins,
                ],
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            if (await sandbox.exists()) {
                manifest.appendSandboxes(await sandbox.sandboxes()).appendSandboxCsp(await sandbox.views().csp());
            }
        },
    };
});
