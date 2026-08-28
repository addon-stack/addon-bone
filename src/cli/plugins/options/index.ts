import {Configuration as RspackConfig, HtmlRspackPlugin} from "@rspack/core";
import HtmlRspackTagsPlugin from "html-rspack-tags-plugin";

import Options from "./Options";

import {definePlugin} from "@main/plugin";
import {EntrypointPlugin} from "@cli/bundler";
import {virtualViewModule} from "@cli/virtual";

import {Command} from "@typing/app";

export default definePlugin(() => {
    let options: Options;

    return {
        name: "adnbn:options",
        startup: ({config}) => {
            options = new Options(config);
        },
        options: () => options.files(),
        bundler: async ({config}) => {
            if (await options.empty()) {
                if (config.debug) {
                    console.info("Options entry not found");
                }

                return {};
            }

            const plugin = EntrypointPlugin.from(await options.view().entries()).virtual(virtualViewModule);

            if (config.command === Command.Watch) {
                plugin.watch(async () => options.clear().view().entries());
            }

            const htmlPlugins = (await options.view().html()).map(options => new HtmlRspackPlugin(options));
            const tagsPlugins = (await options.view().tags()).map(options => new HtmlRspackTagsPlugin(options));

            return {
                plugins: [plugin, ...htmlPlugins, ...tagsPlugins],
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            manifest.setOptions(await options.manifest()).appendCsp(await options.csp());
        },
    };
});
