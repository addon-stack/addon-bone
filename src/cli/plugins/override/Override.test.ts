import {cp, mkdtemp, readFile, rm, writeFile} from "fs/promises";
import os from "os";
import path from "path";

import Override from "./Override";

import {Browser} from "@typing/browser";
import {EntrypointType} from "@typing/entrypoint";
import type {ReadonlyConfig} from "@typing/config";

const fixtures = path.resolve(__dirname, "tests", "fixtures");

/** Wires the manager the way the plugin does: every override handler serves the workspace files. */
const makeOverride = (fixture: string, config: Partial<ReadonlyConfig> = {}): Override => {
    const resolved = {
        app: "myapp",
        appSrcDir: ".",
        appsDir: "apps",
        browser: Browser.Chrome,
        debug: false,
        htmlDir: ".",
        plugins: [],
        rootDir: path.join(fixtures, fixture),
        sharedDir: ".",
        srcDir: "src",
        ...config,
    } as Partial<ReadonlyConfig> as ReadonlyConfig;

    const override = new Override(resolved);

    resolved.plugins.push({
        name: "adnbn:override",
        newtab: () => override.files(EntrypointType.Newtab),
        bookmarks: () => override.files(EntrypointType.Bookmarks),
        history: () => override.files(EntrypointType.History),
    });

    return override;
};

const chromium = [Browser.Chrome, Browser.Chromium, Browser.Edge];

const readPermissions = async (override: Override) => ({
    permissions: await override.permissions(),
    optionalPermissions: await override.optionalPermissions(),
    hostPermissions: await override.hostPermissions(),
    optionalHostPermissions: await override.optionalHostPermissions(),
});

const none = {
    permissions: new Set(),
    optionalPermissions: new Set(),
    hostPermissions: new Set(),
    optionalHostPermissions: new Set(),
};

const declared = {
    newtab: {
        permissions: new Set(["search"]),
        optionalPermissions: new Set(["topSites"]),
        hostPermissions: new Set(["https://*.example.com/*"]),
        optionalHostPermissions: new Set(["https://other.test/*"]),
    },
    bookmarks: {...none, permissions: new Set(["bookmarks"])},
    history: {...none, permissions: new Set(["history"])},
};

describe.each([
    {page: "newtab", supported: [...chromium, Browser.Firefox, Browser.Safari], unsupported: [Browser.Opera]},
    {page: "bookmarks", supported: chromium, unsupported: [Browser.Firefox, Browser.Safari, Browser.Opera]},
    {page: "history", supported: chromium, unsupported: [Browser.Firefox, Browser.Safari, Browser.Opera]},
] as const)("Override with a $page entrypoint", ({page, supported, unsupported}) => {
    test.each(supported)("builds the page, its manifest override, CSP and permissions for %s", async browser => {
        const override = makeOverride(page, {browser});
        const entry = {file: path.join(fixtures, page, "src", `${page}.ts`)};
        const view = await override.view();

        await expect(override.manifest()).resolves.toEqual({page, path: `${page}.html`});
        await expect(override.csp()).resolves.toEqual([{sources: {connect: [`https://${page}.example.com`]}}]);
        await expect(readPermissions(override)).resolves.toEqual(declared[page]);
        await expect(view?.entries()).resolves.toEqual(new Map([[page, new Set([expect.objectContaining(entry)])]]));
        await expect(view?.html()).resolves.toMatchObject([
            {filename: `${page}.html`, title: `Custom ${page}`, chunks: [page]},
        ]);
    });

    test.each(unsupported)("builds nothing for %s, which does not support the page", async browser => {
        const override = makeOverride(page, {browser});

        await expect(override.view()).resolves.toBeUndefined();
        await expect(override.manifest()).resolves.toBeUndefined();
        await expect(override.csp()).resolves.toEqual([]);
        await expect(readPermissions(override)).resolves.toEqual(none);
    });
});

describe("Override with competing entrypoints", () => {
    test.each(chromium)("fails the %s build and names every competing entrypoint", async browser => {
        const override = makeOverride("conflict", {browser});

        const message = [
            `An extension can override only one browser page, but app "myapp" enables 2 override entrypoints for ${browser}:`,
            "  - newtab: src/newtab.ts",
            "  - history: src/history/index.ts",
            'Keep a single override or limit the others with "includeApp", "excludeApp", "includeBrowser" or "excludeBrowser".',
        ].join("\n");

        await expect(override.view()).rejects.toThrow(message);
        await expect(override.manifest()).rejects.toThrow(message);
        await expect(override.csp()).rejects.toThrow(message);
        await expect(readPermissions(override)).rejects.toThrow(message);
    });

    test.each([Browser.Firefox, Browser.Safari])(
        "keeps the new tab for %s because the competing page is not supported there",
        async browser => {
            const override = makeOverride("conflict", {browser});

            await expect(override.manifest()).resolves.toEqual({page: "newtab", path: "newtab.html"});
            await expect(override.csp()).resolves.toEqual([{sources: {connect: ["https://newtab.example.com"]}}]);
            // The skipped History page must not request its browsing-history permission.
            await expect(readPermissions(override)).resolves.toEqual(declared.newtab);
        }
    );

    test.each([
        {browser: Browser.Chrome, page: "history"},
        {browser: Browser.Edge, page: "history"},
        {browser: Browser.Firefox, page: "newtab"},
        {browser: Browser.Safari, page: "newtab"},
    ])("resolves the competition for $browser with entrypoint browser filters", async ({browser, page}) => {
        const override = makeOverride("split", {browser});

        await expect(override.manifest()).resolves.toEqual({page, path: `${page}.html`});
    });
});

describe("Override without entrypoints", () => {
    test("selects nothing", async () => {
        const override = makeOverride("empty");

        await expect(override.view()).resolves.toBeUndefined();
        await expect(override.manifest()).resolves.toBeUndefined();
        await expect(override.csp()).resolves.toEqual([]);
        await expect(readPermissions(override)).resolves.toEqual(none);
    });
});

describe("Override refresh", () => {
    test("clear re-evaluates the selection against the current files", async () => {
        const rootDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-override-"));

        try {
            await cp(path.join(fixtures, "newtab"), rootDir, {recursive: true});

            const override = makeOverride("newtab", {rootDir});

            await expect(override.manifest()).resolves.toEqual({page: "newtab", path: "newtab.html"});

            await rm(path.join(rootDir, "src", "newtab.ts"));
            await writeFile(
                path.join(rootDir, "src", "history.ts"),
                await readFile(path.join(fixtures, "history", "src", "history.ts"))
            );

            await expect(override.manifest()).resolves.toEqual({page: "newtab", path: "newtab.html"});
            await expect(override.clear().manifest()).resolves.toEqual({page: "history", path: "history.html"});
            await expect(override.csp()).resolves.toEqual([{sources: {connect: ["https://history.example.com"]}}]);
        } finally {
            await rm(rootDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        }
    });
});
