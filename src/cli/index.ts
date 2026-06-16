import cac from "cac";
import {consola} from "consola";
import fs from "fs";

import app from "./builders/app";

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
    .option("-a, --app <app>", "Specify an app to run", {default: "myapp"})
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
                manifestVersion: options.mv2 ? 2 : 3,
                rootDir: root,
                configFile: options.config,
            });
        } catch (e) {
            consola.error(e);
        }
    });

cli.command("dev [root]", "Start dev server with HMR")
    .option("-m, --mode <mode>", "Set env mode", {default: "development"})
    .option("-c, --config <config>", "Path to config file")
    .option("-a, --app <app>", "Specify an app to run", {default: "myapp"})
    .option("-b, --browser <browser>", "Specify a browser")
    .option("--mv2", "Target manifest v2")
    .option("-p, --port <port>", "Dev server port")
    .option("-H, --host <host>", "Dev server host")
    .action(async (root, options) => {
        try {
            await app({
                command: Command.Dev,
                mode: options.mode,
                debug: options.debug,
                app: options.app,
                browser: options.browser,
                manifestVersion: options.mv2 ? 2 : 3,
                rootDir: root,
                configFile: options.config,
                server: {
                    // Keep numeric ports numeric, but pass through non-numeric values like
                    // "auto" (a valid dev-server port) instead of coercing them to NaN.
                    ...(options.port !== undefined
                        ? {port: /^\d+$/.test(String(options.port)) ? Number(options.port) : options.port}
                        : {}),
                    ...(options.host ? {host: options.host} : {}),
                },
            });
        } catch (e) {
            consola.error(e);
        }
    });

cli.command("build [root]", "Build for production")
    .option("-m, --mode <mode>", "Set env mode", {default: "production"})
    .option("-c, --config <config>", "Path to config file")
    .option("-a, --app <app>", "Specify an app to run", {default: "myapp"})
    .option("-b, --browser <browser>", "Specify a browser", {default: Browser.Chrome})
    .option("--mv2", "Target manifest v2")
    .option("--analyze", "Visualize extension bundle")
    .action(async (root, options) => {
        try {
            await app({
                command: Command.Build,
                mode: options.mode,
                debug: options.debug,
                app: options.app,
                browser: options.browser,
                manifestVersion: options.mv2 ? 2 : 3,
                rootDir: root,
                configFile: options.config,
                analyze: options.analyze,
            });
        } catch (e) {
            consola.error(e);
        }
    });

cli.version(version);
cli.help();
cli.parse();
