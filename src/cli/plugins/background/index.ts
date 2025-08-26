import {Configuration as RspackConfig} from "@rspack/core";

import {definePlugin} from "@main/plugin";
import {virtualBackgroundModule} from "@cli/virtual";

import {EntrypointPlugin} from "@cli/bundler";

import Background from "./Background";
import BackgroundEntry from "./BackgroundEntry";
import BackgroundManifest from "./BackgroundManifest";
import Command from "./Command";
import Service from "./Service";
import ServiceDeclaration from "./ServiceDeclaration";

import {Command as AppCommand} from "@typing/app";

export default definePlugin(() => {
    let background: Background;
    let command: Command;
    let service: Service;
    let serviceDeclaration: ServiceDeclaration;

    return {
        name: "adnbn:background",
        startup: async ({config}) => {
            background = new Background(config);
            command = new Command(config);
            service = new Service(config);
            serviceDeclaration = new ServiceDeclaration(config);
        },
        background: () => background.files(),
        command: () => command.files(),
        service: () => service.files(),
        bundler: async ({config}) => {
            serviceDeclaration.dictionary(await service.dictionary()).build();

            if ((await background.empty()) && (await command.empty()) && (await service.empty())) {
                if (config.debug) {
                    console.warn("Background, command or service entries not found");
                }

                return {};
            }

            // prettier-ignore
            const backgroundPlugin = EntrypointPlugin.from(await background.entry().entries())
                .virtual(file => virtualBackgroundModule(file));

            // prettier-ignore
            const commandPlugin = EntrypointPlugin.from(await command.entry().entries())
                .virtual(file => command.virtual(file));

            // prettier-ignore
            const servicePlugin = EntrypointPlugin.from(await service.entry().entries())
                .virtual(file => service.virtual(file));

            if (config.command === AppCommand.Watch) {
                backgroundPlugin.watch(() => background.clear().entry().entries());

                commandPlugin.watch(async () => {
                    // Clear the command cache
                    await command.clear().commands();

                    return command.entry().entries();
                });

                servicePlugin.watch(async () => {
                    serviceDeclaration.dictionary(await service.clear().dictionary()).build();

                    return service.entry().entries();
                });
            }

            return {
                plugins: [servicePlugin, commandPlugin, backgroundPlugin],
                optimization: {
                    splitChunks: {
                        chunks(chunk) {
                            return chunk.name !== BackgroundEntry.name;
                        },
                    },
                },
            } satisfies RspackConfig;
        },
        manifest: async ({manifest}) => {
            // prettier-ignore
            const mft = new BackgroundManifest()
                .add(background.entry())
                .add(command.entry())
                .add(service.entry());

            manifest
                .setBackground(
                    (await mft.hasBackground())
                        ? {
                              entry: BackgroundEntry.name,
                              persistent: await mft.isPersistent(),
                          }
                        : undefined
                )
                .setCommands(await command.manifest());

            const permissions = await mft.getPermissions();
            const optionalPermissions = await mft.getOptionalPermissions();
            const hostPermissions = await mft.getHostPermissions();
            const optionalHostPermissions = await mft.getOptionalHostPermissions();

            if (permissions.size > 0) {
                manifest.appendPermissions(permissions);
            }

            if (optionalPermissions.size > 0) {
                manifest.appendOptionalPermissions(optionalPermissions);
            }

            if (hostPermissions.size > 0) {
                manifest.appendHostPermissions(hostPermissions);
            }

            if (optionalHostPermissions.size > 0) {
                manifest.appendOptionalHostPermissions(optionalHostPermissions);
            }
        },
    };
});
