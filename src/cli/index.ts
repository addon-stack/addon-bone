import cac from "cac";
import {consola} from "consola";
import fs from "fs";

import app, {BuildError} from "./builders/app";

import {Command} from "@typing/app";
import {Browser} from "@typing/browser";

const pkg = fs.readFileSync(new URL("../../package.json", import.meta.url), {encoding: "utf-8"});
const {name, version} = JSON.parse(pkg);

const cli = cac(name);

cli.option("--debug", "Enable debug mode");

cli.command("init", "Initialize a new project").action(() => {
    consola.box("Coming soon...");
});

cli.command("watch [root]", "Start watch mode")
    .option("-m, --mode <mode>", "Set env mode", {default: "development"})
    .option("-c, --config <config>", "Path to config file")
    .option("-a, --app <app>", "Specify an app to run", {default: "addon"})
    .option("-b, --browser <browser>", "Specify a browser")
    .option("--mv2", "Target manifest v2")
    .action(async (root, options) => {
        try {
            await app({
                command: Command.Watch,
                mode: options.mode,
                debug: options.debug,
                app: options.app,
                browser: options.browser,
                manifestVersion: options.mv2 ? 2 : undefined,
                rootDir: root,
                configFile: options.config,
            });
        } catch (e) {
            consola.error(e);
            process.exitCode = 1;
        }
    });

cli.command("build [root]", "Build for production")
    .option("-m, --mode <mode>", "Set env mode", {default: "production"})
    .option("-c, --config <config>", "Path to config file")
    .option("-a, --app <app>", "Specify an app to run", {default: "addon"})
    .option("-b, --browser <browser>", "Specify a browser", {default: Browser.Chrome})
    .option("--mv2", "Target manifest v2")
    .option("--analyze", "Visualize extension bundle")
    .action(async (root, options) => {
        try {
            const stats = await app({
                command: Command.Build,
                mode: options.mode,
                debug: options.debug,
                app: options.app,
                browser: options.browser,
                manifestVersion: options.mv2 ? 2 : undefined,
                rootDir: root,
                configFile: options.config,
                analyze: options.analyze,
            });

            if (stats) {
                console.log(stats.toString({colors: true}));
            }
        } catch (e) {
            if (e instanceof BuildError) {
                console.error(e.message);

                if (e.stats) {
                    console.error(e.stats.toString({colors: true, errors: true}));
                }

                if (e.cause !== undefined) {
                    console.error(e.cause);
                }
            } else {
                consola.error(e);
            }

            process.exitCode = 1;
        }
    });

cli.version(version);
cli.help();
cli.parse();
