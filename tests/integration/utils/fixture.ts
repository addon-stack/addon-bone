import {cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink} from "fs/promises";
import path from "path";
import type {buildApp} from "@cli/builders/app";
import {Browser} from "@typing/browser";
import {Mode} from "@typing/app";

import {run} from "./process";

interface AppBuildModule {
    buildApp: typeof buildApp;
}

export type IntegrationFixtureBuildMode = "cli" | "in-process";

export interface IntegrationFixtureBuildOptions {
    buildMode?: IntegrationFixtureBuildMode;
    browser?: string;
    manifestVersion?: 2 | 3;
}

export interface IntegrationFixture {
    readonly directory: string;
    build(options?: IntegrationFixtureBuildOptions): Promise<string>;
    dispose(): Promise<void>;
}

const generatedDirectories = new Set(["node_modules", ".adnbn", "dist"]);

const linkDependency = async (source: string, destination: string): Promise<void> => {
    const target = await realpath(source);
    const existing = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
            throw error;
        }

        return undefined;
    });

    if (existing) {
        if ((await realpath(destination)) === target) {
            return;
        }

        throw new Error(`Integration dependency already exists at ${destination}; expected a link to ${target}`);
    }

    await mkdir(path.dirname(destination), {recursive: true});
    await symlink(target, destination, process.platform === "win32" ? "junction" : "dir");
};

export const prepareIntegrationFixture = async (
    projectRoot: string,
    directory: string,
    {browser = "chrome", manifestVersion = 3, buildMode = "cli"}: IntegrationFixtureBuildOptions = {},
    timeout?: number
): Promise<string> => {
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
    };

    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        await linkDependency(
            dependency === "adnbn" ? projectRoot : path.join(projectRoot, "node_modules", dependency),
            path.join(directory, "node_modules", dependency)
        );
    }

    if (buildMode === "in-process") {
        // Jest replaces createRequire and process.env. Use Node's loader in this same worker,
        // lending it the test environment only for the awaited build.
        const nodeProcess = process.getBuiltinModule("process");
        const require = process.getBuiltinModule("module").createRequire(path.join(projectRoot, "package.json"));
        const environment = nodeProcess.env;
        nodeProcess.env = process.env;

        try {
            const app = require(path.join(projectRoot, "dist/cli/builders/app/index.js")) as AppBuildModule;
            await app.buildApp({
                rootDir: path.resolve(directory),
                browser: browser as Browser,
                manifestVersion,
                mode: Mode.Production,
            });
        } finally {
            nodeProcess.env = environment;
        }
    } else {
        await run(
            process.execPath,
            [
                path.join(projectRoot, "bin", "adnbn.js"),
                "build",
                ".",
                "-b",
                browser,
                ...(manifestVersion === 2 ? ["--mv2"] : []),
            ],
            directory,
            timeout
        );
    }

    return path.join(directory, "dist", `myapp-${browser}-mv${manifestVersion}`);
};

export const createIntegrationFixture = async (
    projectRoot: string,
    sourceDirectory: string,
    buildMode: IntegrationFixtureBuildMode = "cli"
): Promise<IntegrationFixture> => {
    const cacheDirectory = path.join(projectRoot, ".cache", "integration");

    await mkdir(cacheDirectory, {recursive: true});

    const directory = await mkdtemp(path.join(cacheDirectory, "fixture-"));
    const dispose = () => rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});

    try {
        await cp(sourceDirectory, directory, {
            recursive: true,
            filter: source => !generatedDirectories.has(path.basename(source)),
        });
    } catch (error) {
        await dispose();
        throw error;
    }

    return {
        directory,
        build: options => prepareIntegrationFixture(projectRoot, directory, {buildMode, ...options}),
        dispose,
    };
};

export const findIntegrationFixtures = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, {withFileTypes: true});

    const hasConfig = entries.some(entry => entry.isFile() && entry.name === "adnbn.config.ts");
    const hasPackage = entries.some(entry => entry.isFile() && entry.name === "package.json");

    if (hasConfig && hasPackage) {
        return [directory];
    }

    const fixtures: string[] = [];

    for (const entry of entries) {
        if (entry.isDirectory() && !generatedDirectories.has(entry.name)) {
            fixtures.push(...(await findIntegrationFixtures(path.join(directory, entry.name))));
        }
    }

    return fixtures.sort();
};
