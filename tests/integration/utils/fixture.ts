import {cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink} from "fs/promises";
import path from "path";

import {run} from "./process";

export interface IntegrationFixtureBuildOptions {
    browser?: string;
    manifestVersion?: 2 | 3;
}

export interface IntegrationFixture {
    readonly directory: string;
    build(options?: IntegrationFixtureBuildOptions): Promise<string>;
    dispose(): Promise<void>;
}

const GeneratedDirectories = new Set(["node_modules", ".adnbn", "dist"]);

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
    {browser = "chrome", manifestVersion = 3}: IntegrationFixtureBuildOptions = {}
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
        directory
    );

    return path.join(directory, "dist", `myapp-${browser}-mv${manifestVersion}`);
};

export const createIntegrationFixture = async (
    projectRoot: string,
    sourceDirectory: string
): Promise<IntegrationFixture> => {
    const cacheDirectory = path.join(projectRoot, ".cache", "integration");

    await mkdir(cacheDirectory, {recursive: true});

    const directory = await mkdtemp(path.join(cacheDirectory, "fixture-"));
    const dispose = () => rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});

    try {
        await cp(sourceDirectory, directory, {
            recursive: true,
            filter: source => !GeneratedDirectories.has(path.basename(source)),
        });
    } catch (error) {
        await dispose();
        throw error;
    }

    return {
        directory,
        build: options => prepareIntegrationFixture(projectRoot, directory, options),
        dispose,
    };
};

export const findIntegrationFixtures = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, {withFileTypes: true});

    if (entries.some(entry => entry.isFile() && entry.name === "adnbn.config.ts")) {
        return [directory];
    }

    const fixtures: string[] = [];

    for (const entry of entries) {
        if (entry.isDirectory() && !GeneratedDirectories.has(entry.name)) {
            fixtures.push(...(await findIntegrationFixtures(path.join(directory, entry.name))));
        }
    }

    return fixtures.sort();
};
