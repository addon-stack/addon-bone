import {cp, mkdtemp, rm} from "fs/promises";
import os from "os";
import path from "path";

import PopupFinder from "./PopupFinder";

import type {ReadonlyConfig} from "@typing/config";

const fixtures = path.resolve(__dirname, "tests", "fixtures");

const makeFinder = (rootDir: string, overrides: Partial<ReadonlyConfig> = {}): PopupFinder => {
    const config = {
        app: "myapp",
        appSrcDir: ".",
        appsDir: "apps",
        debug: false,
        htmlDir: ".",
        mergePopup: false,
        multiplePopup: false,
        plugins: [],
        rootDir,
        sharedDir: ".",
        srcDir: "src",
        ...overrides,
    } as Partial<ReadonlyConfig> as ReadonlyConfig;

    const finder = new PopupFinder(config);

    config.plugins.push({name: "adnbn:popup", popup: () => finder.files()});

    return finder;
};

const read = async (finder: PopupFinder) => ({
    permissions: await finder.permissions(),
    optionalPermissions: await finder.optionalPermissions(),
    hostPermissions: await finder.hostPermissions(),
    optionalHostPermissions: await finder.optionalHostPermissions(),
});

describe("ViewPermissionsFinder", () => {
    const selection = path.join(fixtures, "selection");

    test("unites the permissions of every built view without duplicates", async () => {
        await expect(read(makeFinder(selection, {multiplePopup: true}))).resolves.toEqual({
            permissions: new Set(["tabs", "storage", "downloads"]),
            optionalPermissions: new Set(["topSites"]),
            hostPermissions: new Set(["https://*.example.com/*"]),
            optionalHostPermissions: new Set(["https://other.test/*"]),
        });
    });

    test("takes the permissions of the winning view only when a single view is allowed", async () => {
        await expect(read(makeFinder(selection))).resolves.toEqual({
            permissions: new Set(["tabs", "downloads"]),
            optionalPermissions: new Set(["topSites"]),
            hostPermissions: new Set(),
            optionalHostPermissions: new Set(["https://other.test/*"]),
        });
    });

    test("returns empty sets when the built views declare no permissions", async () => {
        const project = path.join(fixtures, "precedence", "project");

        await expect(read(makeFinder(project, {sharedDir: "shared"}))).resolves.toEqual({
            permissions: new Set(),
            optionalPermissions: new Set(),
            hostPermissions: new Set(),
            optionalHostPermissions: new Set(),
        });
    });

    test("clear drops the permissions of a view that no longer exists", async () => {
        const rootDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-view-permissions-"));

        try {
            await cp(selection, rootDir, {recursive: true});

            const finder = makeFinder(rootDir, {multiplePopup: true});

            await expect(finder.permissions()).resolves.toEqual(new Set(["tabs", "storage", "downloads"]));

            await rm(path.join(rootDir, "src", "settings.popup.ts"));

            await expect(finder.permissions()).resolves.toEqual(new Set(["tabs", "storage", "downloads"]));
            await expect(finder.clear().permissions()).resolves.toEqual(new Set(["tabs", "storage"]));
            await expect(finder.optionalPermissions()).resolves.toEqual(new Set());
        } finally {
            await rm(rootDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        }
    });
});
