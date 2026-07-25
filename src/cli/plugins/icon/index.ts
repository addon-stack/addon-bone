import {Configuration as RspackConfig, CopyRspackPlugin} from "@rspack/core";

import {definePlugin} from "@main/plugin";
import {VirtualDataPlugin} from "@cli/bundler";

import Icon, {CopyPatterns, IconDefinition} from "./Icon";

import {IconDeclaration} from "./declaration";

import {isWatchCommand} from "@typing/app";

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

            const data = new VirtualDataPlugin("icon", {icons: await icon.define()});

            if (isWatchCommand(config.command)) {
                const files = Array.from(await icon.files(), file => file.file);

                data.watch({
                    update: async () => ({icons: await icon.clear().define()}),
                    files,
                    dirs: icon.directories(),
                });
            }

            return {
                plugins: [new CopyRspackPlugin({patterns: await icon.copy()}), data],
                resolve: {alias: data.alias()},
            } satisfies RspackConfig;
        },
        manifest: async ({manifest, config}) => {
            manifest.setIcons(await icon.manifest()).setIcon(config.icon);
        },
    };
});
