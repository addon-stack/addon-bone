import Options from "./Options";

import type {ReadonlyConfig} from "@typing/config";
import type {OptionsEntrypointOptions} from "@typing/options";
import {EntrypointFile, EntrypointOptionsFinder, EntrypointType} from "@typing/entrypoint";

class TestOptions extends Options {
    public constructor(
        config: Partial<ReadonlyConfig>,
        private readonly pluginOptions: Map<EntrypointFile, OptionsEntrypointOptions>
    ) {
        super(config as ReadonlyConfig);
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
}

const config: Partial<ReadonlyConfig> = {
    app: "app",
    appSrcDir: ".",
    appsDir: "apps",
    debug: false,
    htmlDir: "pages",
    plugins: [],
    rootDir: "/project",
    sharedDir: ".",
    srcDir: "src",
};

const file = (filename: string): EntrypointFile => ({
    file: filename,
    import: filename,
});

describe("Options", () => {
    test("uses the selected view filename and retains false after stripping manifest settings from the view", async () => {
        const fallback = file("/plugins/default/options.ts");
        const selected = file("/project/src/options.tsx");
        const options = new TestOptions(
            config,
            new Map<EntrypointFile, OptionsEntrypointOptions>([
                [fallback, {as: "fallback", openInTab: true}],
                [selected, {as: "preferences", openInTab: false}],
            ])
        );

        const [view] = (await options.views()).values();

        expect(view.options).not.toHaveProperty("openInTab");
        await expect(options.manifest()).resolves.toEqual({
            path: "pages/preferences.options.html",
            openInTab: false,
        });
    });

    test("returns no manifest options when there is no selected view", async () => {
        await expect(new TestOptions(config, new Map()).manifest()).resolves.toBeUndefined();
    });

    test("clear refreshes the view, manifest and CSP without incrementing the output name", async () => {
        const initial = file("/project/src/options.ts");
        const replacement = file("/project/src/replacement.options.tsx");
        const parsed = new Map<EntrypointFile, OptionsEntrypointOptions>([
            [initial, {as: "preferences", openInTab: true, csp: {wasm: true}}],
        ]);
        const options = new TestOptions(config, parsed);
        const firstView = options.view();

        await expect(options.manifest()).resolves.toEqual({
            path: "pages/preferences.options.html",
            openInTab: true,
        });
        await expect(options.csp()).resolves.toEqual([{wasm: true}]);

        parsed.clear();
        parsed.set(replacement, {as: "preferences", openInTab: false});
        options.clear();

        expect(options.view()).not.toBe(firstView);
        await expect(options.csp()).resolves.toEqual([]);
        await expect(options.manifest()).resolves.toEqual({
            path: "pages/preferences.options.html",
            openInTab: false,
        });
        await expect(options.view().entries()).resolves.toEqual(
            new Map([["preferences.options", new Set([replacement])]])
        );
    });
});
