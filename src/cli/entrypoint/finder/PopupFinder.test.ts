import PopupFinder from "./PopupFinder";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointFile, EntrypointOptionsFinder, EntrypointType} from "@typing/entrypoint";
import {PopupEntrypointOptions} from "@typing/popup";

class TestPopupFinder extends PopupFinder {
    public constructor(
        config: ReadonlyConfig,
        private readonly pluginOptions: Map<EntrypointFile, PopupEntrypointOptions>
    ) {
        super(config);
    }

    public plugin(): EntrypointOptionsFinder<PopupEntrypointOptions> {
        return createPlugin(this.pluginOptions);
    }
}

const config = {
    app: "app",
    appSrcDir: ".",
    appsDir: "apps",
    debug: false,
    htmlDir: ".",
    mergePopup: false,
    multiplePopup: false,
    plugins: [],
    rootDir: "/project",
    sharedDir: "shared",
    srcDir: "src",
} as Partial<ReadonlyConfig> as ReadonlyConfig;

const file = (filename: string): EntrypointFile => ({
    file: filename,
    import: filename,
});

const createPlugin = (
    options: Map<EntrypointFile, PopupEntrypointOptions>
): EntrypointOptionsFinder<PopupEntrypointOptions> => ({
    type: () => EntrypointType.Popup,
    options: async () => options,
    contracts: async () => new Map(Array.from(options.keys()).map(entry => [entry, undefined])),
    files: async () => new Set(options.keys()),
    empty: async () => options.size === 0,
    exists: async () => options.size > 0,
    clear: function () {
        return this;
    },
    holds: entry => options.has(entry),
});

describe("PopupFinder", () => {
    test("selects the highest-priority popup when multiple popups are disabled", async () => {
        const plugin = file("/plugins/default/popup.ts");
        const shared = file("/project/src/shared/popup.ts");
        const app = file("/project/src/apps/app/popup.ts");
        const finder = new TestPopupFinder(
            config,
            new Map([
                [plugin, {csp: {sources: {connect: ["https://plugin.example.com"]}}}],
                [shared, {csp: {sources: {connect: ["https://shared.example.com"]}}}],
                [app, {csp: {sources: {connect: ["https://app.example.com"]}}}],
            ])
        );

        const views = await finder.views();

        expect(views.size).toBe(1);
        expect([...views.values()][0].file).toBe(app);
        await expect(finder.csp()).resolves.toEqual([
            {
                sources: {
                    connect: ["https://app.example.com"],
                },
            },
        ]);
    });
});
