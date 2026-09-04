import ContentManager from "./ContentManager";

import type {ContentDriver, ContentItems, ContentProvider} from "./types";

import type {ReadonlyConfig} from "@typing/config";
import {ContentScriptWorld, type ContentScriptEntrypointOptions} from "@typing/content";
import type {EntrypointFile} from "@typing/entrypoint";
import type {ManifestOptionalPermissions, ManifestPermissions} from "@typing/manifest";

class DriverFixture implements ContentDriver<ContentScriptEntrypointOptions> {
    public constructor(
        private readonly required: ManifestPermissions,
        private readonly optional: ManifestOptionalPermissions,
        private contentItems: ContentItems<ContentScriptEntrypointOptions> = new Map()
    ) {}

    public setItems(contentItems: ContentItems<ContentScriptEntrypointOptions>): void {
        this.contentItems = contentItems;
    }

    public async items(): Promise<ContentItems<ContentScriptEntrypointOptions>> {
        return this.contentItems;
    }

    public async permissions(): Promise<ManifestPermissions> {
        return this.required;
    }

    public async optionalPermissions(): Promise<ManifestOptionalPermissions> {
        return this.optional;
    }
}

class ProviderFixture implements ContentProvider<ContentScriptEntrypointOptions> {
    public constructor(private readonly contentDriver: DriverFixture) {}

    public virtual(_file: EntrypointFile): string {
        return "";
    }

    public driver(): DriverFixture {
        return this.contentDriver;
    }

    public clear(): this {
        return this;
    }
}

describe("ContentManager permissions", () => {
    test("aggregates driver permissions and gives required permissions precedence", async () => {
        const manager = new ContentManager({rootDir: process.cwd()} as ReadonlyConfig)
            .provider(
                new ProviderFixture(
                    new DriverFixture(
                        new Set<chrome.runtime.ManifestPermission>(["scripting"]),
                        new Set<chrome.runtime.ManifestOptionalPermission>(["activeTab"])
                    )
                )
            )
            .provider(
                new ProviderFixture(
                    new DriverFixture(
                        new Set<chrome.runtime.ManifestPermission>(["webNavigation"]),
                        new Set<chrome.runtime.ManifestOptionalPermission>(["scripting"])
                    )
                )
            );

        await expect(manager.permissions()).resolves.toEqual(new Set(["scripting", "webNavigation"]));
        await expect(manager.optionalPermissions()).resolves.toEqual(new Set(["activeTab"]));
    });
});

describe("ContentManager execution worlds", () => {
    test("normalizes MV2 worlds before grouping and warns without changing provider options", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const main = {file: "main.content.ts", import: "./main.content"};
        const isolated = {file: "isolated.content.ts", import: "./isolated.content"};
        const mainOptions = {world: ContentScriptWorld.Main, matches: ["https://example.com/*"]};
        const items: ContentItems<ContentScriptEntrypointOptions> = new Map([
            ["main", {file: main, options: mainOptions}],
            ["isolated", {file: isolated, options: {matches: mainOptions.matches}}],
        ]);
        const manager = new ContentManager({
            manifestVersion: 2,
            concatContentScripts: true,
            rootDir: process.cwd(),
        } as ReadonlyConfig).provider(new ProviderFixture(new DriverFixture(new Set(), new Set(), items)));

        try {
            await expect(manager.entries()).resolves.toEqual(new Map([["main.content", new Set([main, isolated])]]));
            await expect(manager.entryWorlds()).resolves.toEqual(
                new Map([["main.content", ContentScriptWorld.Isolated]])
            );
            expect(Array.from(await manager.manifest())).toEqual([
                expect.objectContaining({entry: "main.content", world: ContentScriptWorld.Isolated}),
            ]);
            expect(mainOptions.world).toBe(ContentScriptWorld.Main);
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(
                'Content script "main.content.ts" requests world "MAIN", but Addon Bone does not support MAIN content scripts in Manifest V2. It will be built and run in ISOLATED.'
            );
        } finally {
            warn.mockRestore();
        }
    });

    test("refreshes MV2 effective worlds and warnings after clearing for a watch rebuild", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const file = {file: "changing.content.ts", import: "./changing.content"};
        const driver = new DriverFixture(new Set(), new Set(), new Map([["changing", {file, options: {}}]]));
        const manager = new ContentManager({
            manifestVersion: 2,
            concatContentScripts: false,
            rootDir: process.cwd(),
        } as ReadonlyConfig).provider(new ProviderFixture(driver));

        try {
            await expect(manager.entryWorlds()).resolves.toEqual(
                new Map([["changing.content", ContentScriptWorld.Isolated]])
            );
            expect(warn).not.toHaveBeenCalled();

            driver.setItems(new Map([["changing", {file, options: {world: ContentScriptWorld.Main}}]]));
            manager.clear();

            await expect(manager.entryWorlds()).resolves.toEqual(
                new Map([["changing.content", ContentScriptWorld.Isolated]])
            );
            await manager.entries();
            await manager.manifest();
            expect(warn).toHaveBeenCalledTimes(1);

            driver.setItems(new Map([["changing", {file, options: {world: ContentScriptWorld.Isolated}}]]));
            manager.clear();
            await manager.entryWorlds();
            expect(warn).toHaveBeenCalledTimes(1);
        } finally {
            warn.mockRestore();
        }
    });

    test("treats an omitted world as ISOLATED and keeps MAIN entries separate", async () => {
        const isolated = {file: "isolated.content.ts", import: "./isolated.content"};
        const main = {file: "main.content.ts", import: "./main.content"};
        const reservedMain = {file: "common-main.content.ts", import: "./common-main.content"};
        const items: ContentItems<ContentScriptEntrypointOptions> = new Map([
            ["isolated", {file: isolated, options: {}}],
            ["main", {file: main, options: {world: "MAIN"}}],
            ["common-main", {file: reservedMain, options: {world: ContentScriptWorld.Main}}],
        ]);
        const manager = new ContentManager({
            concatContentScripts: false,
            rootDir: process.cwd(),
        } as ReadonlyConfig).provider(new ProviderFixture(new DriverFixture(new Set(), new Set(), items)));

        await expect(manager.entryWorlds()).resolves.toEqual(
            new Map([
                ["isolated.content", ContentScriptWorld.Isolated],
                ["main.content", ContentScriptWorld.Main],
                ["common-main1.content", ContentScriptWorld.Main],
            ])
        );
    });

    test("recalculates concatenated entrypoint names after clear", async () => {
        const options = {matches: ["https://example.com/*"]};
        const first = {file: "first.content.ts", import: "./first.content"};
        const renamed = {file: "renamed.content.ts", import: "./renamed.content"};
        const driver = new DriverFixture(new Set(), new Set(), new Map([["first", {file: first, options}]]));
        const manager = new ContentManager({
            concatContentScripts: true,
            rootDir: process.cwd(),
        } as ReadonlyConfig).provider(new ProviderFixture(driver));

        await expect(manager.entries()).resolves.toEqual(new Map([["first.content", new Set([first])]]));

        driver.setItems(new Map([["renamed", {file: renamed, options}]]));
        manager.clear();

        await expect(manager.entries()).resolves.toEqual(new Map([["renamed.content", new Set([renamed])]]));
    });

    test("normalizes MAIN shadow entrypoints to ISOLATED for Manifest V2", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const file = {file: "shadow.content.ts", import: "./shadow.content"};
        const items: ContentItems<ContentScriptEntrypointOptions> = new Map([
            ["shadow", {file, options: {shadow: true, world: ContentScriptWorld.Main}}],
        ]);
        const manager = new ContentManager({
            manifestVersion: 2,
            concatContentScripts: true,
            rootDir: process.cwd(),
        } as ReadonlyConfig).provider(new ProviderFixture(new DriverFixture(new Set(), new Set(), items)));

        try {
            await expect(manager.entryWorlds()).resolves.toEqual(
                new Map([["shadow.content", ContentScriptWorld.Isolated]])
            );
            await expect(manager.entryShadows()).resolves.toEqual(new Map([["shadow.content", true]]));
        } finally {
            warn.mockRestore();
        }
    });

    test("rejects Shadow DOM in the MAIN world for Manifest V3", async () => {
        const file = {file: "shadow.content.ts", import: "./shadow.content"};
        const items: ContentItems<ContentScriptEntrypointOptions> = new Map([
            ["shadow", {file, options: {shadow: true, world: ContentScriptWorld.Main}}],
        ]);
        const manager = new ContentManager({
            manifestVersion: 3,
            concatContentScripts: false,
            rootDir: process.cwd(),
        } as ReadonlyConfig).provider(new ProviderFixture(new DriverFixture(new Set(), new Set(), items)));

        await expect(manager.entries()).rejects.toThrow(/cannot use Shadow DOM in the MAIN execution world/);
    });
});

describe("ContentManager Shadow DOM entries", () => {
    test("never concatenates shadow entries and keeps ordinary entries eligible for concatenation", async () => {
        const matches = ["https://example.com/*"];
        const normalA = {file: "normal-a.content.ts", import: "./normal-a.content"};
        const normalB = {file: "normal-b.content.ts", import: "./normal-b.content"};
        const shadowA = {file: "shadow-a.content.ts", import: "./shadow-a.content"};
        const shadowB = {file: "shadow-b.content.ts", import: "./shadow-b.content"};
        const items: ContentItems<ContentScriptEntrypointOptions> = new Map([
            ["normal-a", {file: normalA, options: {matches}}],
            ["normal-b", {file: normalB, options: {matches}}],
            ["shadow-a", {file: shadowA, options: {matches, shadow: true}}],
            ["shadow-b", {file: shadowB, options: {matches, shadow: true}}],
        ]);
        const manager = new ContentManager({
            manifestVersion: 3,
            concatContentScripts: true,
            rootDir: process.cwd(),
        } as ReadonlyConfig).provider(new ProviderFixture(new DriverFixture(new Set(), new Set(), items)));

        await expect(manager.entries()).resolves.toEqual(
            new Map([
                ["normal-a.content", new Set([normalA, normalB])],
                ["shadow-a.content", new Set([shadowA])],
                ["shadow-b.content", new Set([shadowB])],
            ])
        );
        await expect(manager.entryShadows()).resolves.toEqual(
            new Map([
                ["normal-a.content", false],
                ["shadow-a.content", true],
                ["shadow-b.content", true],
            ])
        );
    });

    test("recalculates shadow mode after clear for watch rebuilds", async () => {
        const file = {file: "changing.content.ts", import: "./changing.content"};
        const driver = new DriverFixture(
            new Set(),
            new Set(),
            new Map([["changing", {file, options: {shadow: true}}]])
        );
        const manager = new ContentManager({
            manifestVersion: 3,
            concatContentScripts: false,
            rootDir: process.cwd(),
        } as ReadonlyConfig).provider(new ProviderFixture(driver));

        await expect(manager.entryShadows()).resolves.toEqual(new Map([["changing.content", true]]));
        await expect(manager.manifest()).resolves.toEqual(
            new Set([expect.objectContaining({entry: "changing.content", shadow: true})])
        );

        driver.setItems(new Map([["changing", {file, options: {shadow: false}}]]));
        manager.clear();
        await expect(manager.entryShadows()).resolves.toEqual(new Map([["changing.content", false]]));
        await expect(manager.manifest()).resolves.toEqual(
            new Set([expect.objectContaining({entry: "changing.content", shadow: false})])
        );

        driver.setItems(new Map([["changing", {file, options: {shadow: true}}]]));
        manager.clear();
        await expect(manager.entryShadows()).resolves.toEqual(new Map([["changing.content", true]]));
        await expect(manager.manifest()).resolves.toEqual(
            new Set([expect.objectContaining({entry: "changing.content", shadow: true})])
        );
    });
});
