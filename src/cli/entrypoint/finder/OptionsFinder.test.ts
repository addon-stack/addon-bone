import path from "path";

import OptionsFinder from "./OptionsFinder";
import View from "@cli/plugins/view/View";
import {toPosix} from "@cli/utils/path";

import type {ReadonlyConfig} from "@typing/config";
import type {OptionsEntrypointOptions} from "@typing/options";
import {EntrypointFile, EntrypointOptionsFinder, EntrypointType} from "@typing/entrypoint";

class TestOptionsFinder extends OptionsFinder {
    public constructor(
        config: ReadonlyConfig,
        private readonly pluginOptions: Map<EntrypointFile, OptionsEntrypointOptions>
    ) {
        super(config);
    }

    public plugin(): EntrypointOptionsFinder<OptionsEntrypointOptions> {
        return {
            type: () => EntrypointType.Options,
            options: async () => this.pluginOptions,
            contracts: async () => new Map(Array.from(this.pluginOptions.keys()).map(entry => [entry, undefined])),
            files: async () => new Set(this.pluginOptions.keys()),
            empty: async () => this.pluginOptions.size === 0,
            exists: async () => this.pluginOptions.size > 0,
            clear() {
                return this;
            },
            holds: entry => this.pluginOptions.has(entry),
        };
    }

    public scan(directory: string): Set<EntrypointFile> {
        return this.findFiles(directory);
    }
}

const makeConfig = (overrides: Partial<ReadonlyConfig> = {}) =>
    ({
        app: "app",
        appSrcDir: ".",
        appsDir: "apps",
        debug: false,
        htmlDir: ".",
        plugins: [],
        rootDir: "/project",
        sharedDir: ".",
        srcDir: "src",
        ...overrides,
    }) as ReadonlyConfig;

const config = makeConfig();

const file = (filename: string): EntrypointFile => ({
    file: filename,
    import: filename,
});

describe("OptionsFinder", () => {
    test("discovers options files and index directories without treating options as a separate plural group", () => {
        const fixtures = path.resolve(__dirname, "tests", "fixtures", "options", "discovery");
        const finder = new TestOptionsFinder(config, new Map());

        const files = [...finder.scan(fixtures)].map(({file}) => toPosix(path.relative(fixtures, file))).sort();

        expect(files).toEqual(["account.options.tsx", "advanced.options/index.tsx", "options.ts", "options/index.ts"]);
    });

    test("selects the highest-priority options page and only collects its CSP", async () => {
        const plugin = file("/plugins/default/options.ts");
        const shared = file("/project/src/shared/options.ts");
        const app = file("/project/src/apps/app/options.tsx");
        const finder = new TestOptionsFinder(
            config,
            new Map<EntrypointFile, OptionsEntrypointOptions>([
                [plugin, {csp: {sources: {connect: ["https://plugin.example.com"]}}}],
                [shared, {csp: {sources: {connect: ["https://shared.example.com"]}}}],
                [app, {openInTab: false, csp: {sources: {connect: ["https://app.example.com"]}}}],
            ])
        );

        await expect(finder.views()).resolves.toEqual(
            new Map([["options", {alias: "options", filename: "options.html", file: app, options: {}}]])
        );
        await expect(finder.csp()).resolves.toEqual([{sources: {connect: ["https://app.example.com"]}}]);
    });

    test("keeps manifest settings out of HTML tags while preserving the parsed source options", async () => {
        const entry = file("/project/src/options.ts");
        const options: OptionsEntrypointOptions = {
            openInTab: false,
            title: "Preferences",
            template: "./options.html",
            links: ["options.css"],
            metas: {attributes: {name: "viewport", content: "width=device-width, initial-scale=1"}},
            csp: {wasm: true},
        };
        const viewConfig = makeConfig({htmlDir: "pages"});
        const finder = new TestOptionsFinder(viewConfig, new Map([[entry, options]]));
        const view = new View(viewConfig, finder);

        await expect(view.tags()).resolves.toEqual([
            {
                links: ["options.css"],
                metas: {attributes: {name: "viewport", content: "width=device-width, initial-scale=1"}},
                files: ["pages/options.html"],
            },
        ]);
        await expect(view.html()).resolves.toMatchObject([
            {
                filename: "pages/options.html",
                title: "Preferences",
                template: path.resolve("/project/src/options.html"),
                chunks: ["options"],
            },
        ]);
        await expect(view.entries()).resolves.toEqual(new Map([["options", new Set([entry])]]));
        expect((await finder.plugin().options()).get(entry)).toEqual(options);
        expect(options.openInTab).toBe(false);
        expect(options.csp).toEqual({wasm: true});
    });

    test("supports view naming and resets its caches without incrementing the output filename", async () => {
        const entry = file("/project/src/options.ts");
        const options = new Map<EntrypointFile, OptionsEntrypointOptions>([
            [entry, {as: "preferences", csp: {wasm: true}}],
        ]);
        const finder = new TestOptionsFinder(config, options);

        await expect(finder.views()).resolves.toMatchObject(
            new Map([["preferences.options", {filename: "preferences.options.html"}]])
        );
        await expect(finder.csp()).resolves.toEqual([{wasm: true}]);

        options.set(entry, {as: "preferences", openInTab: true, title: "Updated"});
        finder.clear();

        await expect(finder.views()).resolves.toMatchObject(
            new Map([["preferences.options", {filename: "preferences.options.html", options: {title: "Updated"}}]])
        );
        await expect(finder.csp()).resolves.toEqual([]);
    });

    test("does not create a view when no options entrypoint is selected", async () => {
        const finder = new TestOptionsFinder(config, new Map());

        await expect(finder.views()).resolves.toEqual(new Map());
        await expect(finder.csp()).resolves.toEqual([]);
    });
});
