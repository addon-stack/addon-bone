import {Configuration as RspackConfig, CopyRspackPlugin, DefinePlugin} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import Icon, {CopyPatterns, IconDefinition} from "./Icon";

import {IconDeclaration} from "./declaration";

import {defineTopology} from "@cli/utils/topology";

export {Icon, type IconDefinition, type CopyPatterns};

export default definePlugin(() => {
    let icon: Icon;

    return {
        name: "adnbn:icon",
        topology: async () => ({
            defines: [defineTopology({name: "__ADNBN_ICONS__", value: await icon.define()})],
        }),
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
                    new DefinePlugin({
                        __ADNBN_ICONS__: JSON.stringify(await icon.define()),
                    }),
                ],
            } satisfies RspackConfig;
        },
        manifest: async ({manifest, config}) => {
            manifest.setIcons(await icon.manifest()).setIcon(config.icon);
        },
    };
});
