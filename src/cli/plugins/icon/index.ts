import {Configuration as RspackConfig, CopyRspackPlugin} from "@rspack/core";

import {definePlugin} from "@main/plugin";
import {GenerateModulePlugin} from "@cli/bundler";

import Icon, {CopyPatterns, IconDefinition} from "./Icon";
import {createIconModule, IconModuleName} from "./icon-module";

import {IconDeclaration} from "./declaration";

export {Icon, type IconDefinition, type CopyPatterns};

export default definePlugin(() => {
    let icon: Icon;

    return {
        name: "adnbn:icon",
        startup: ({config}) => {
            icon = new Icon(config);
        },
        icon: () => icon.files(),
        bundler: async ({config}) => {
            new IconDeclaration(config).setNames(await icon.names()).build();

            return {
                plugins: [
                    new CopyRspackPlugin({
                        patterns: await icon.copy(),
                    }),
                    new GenerateModulePlugin({
                        [IconModuleName]: createIconModule(await icon.define()),
                    }),
                ],
            } satisfies RspackConfig;
        },
        manifest: async ({manifest, config}) => {
            manifest.setIcons(await icon.manifest()).setIcon(config.icon);
        },
    };
});
