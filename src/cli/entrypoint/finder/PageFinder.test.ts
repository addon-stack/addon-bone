import PageFinder from "./PageFinder";

import {EntrypointFile, EntrypointOptionsFinder, EntrypointType} from "@typing/entrypoint";
import type {PageEntrypointOptions} from "@typing/page";
import type {ReadonlyConfig} from "@typing/config";

class ExposedPageFinder extends PageFinder {
    public constructor(
        config: ReadonlyConfig,
        private readonly pluginOptions?: Map<EntrypointFile, PageEntrypointOptions>
    ) {
        super(config);
    }

    public plugin(): EntrypointOptionsFinder<PageEntrypointOptions> {
        return this.pluginOptions ? createPlugin(this.pluginOptions) : super.plugin();
    }

    public aliasFrom(file: EntrypointFile, options: PageEntrypointOptions): string {
        return this.createViewAlias(file, options);
    }
}

const makeConfig = (overrides: Partial<ReadonlyConfig> = {}) =>
    ({
        app: "app",
        appSrcDir: ".",
        appsDir: "apps",
        debug: false,
        htmlDir: ".",
        mergePages: true,
        plugins: [],
        rootDir: "/project",
        sharedDir: ".",
        srcDir: "src",
        ...overrides,
    }) as ReadonlyConfig;

const config = makeConfig();

const file = (name: string): EntrypointFile => ({
    file: `/project/src/${name}`,
    import: `@/${name}`,
});

const createPlugin = (
    options: Map<EntrypointFile, PageEntrypointOptions>
): EntrypointOptionsFinder<PageEntrypointOptions> => ({
    type: () => EntrypointType.Page,
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

describe("PageFinder", () => {
    test("follows mergePages from config", () => {
        expect(new PageFinder(makeConfig({mergePages: true})).canMerge()).toBe(true);
        expect(new PageFinder(makeConfig({mergePages: false})).canMerge()).toBe(false);
    });

    test("keeps page filenames away from reserved entrypoint output", async () => {
        const page = new ExposedPageFinder(config, new Map([[file("sandbox.ts"), {as: "sandbox"}]]));

        await expect(page.views()).resolves.toMatchObject(new Map([["sandbox.page", {filename: "sandbox1.html"}]]));
    });

    test("uses page name as an alias when it is defined", () => {
        expect(new ExposedPageFinder(config).aliasFrom(file("named.ts"), {name: "docs"})).toBe("docs");
    });

    test("uses filename as an alias when page name is absent", () => {
        expect(new ExposedPageFinder(config).aliasFrom(file("plain.page.ts"), {})).toBe("plain");
    });

    test("keeps external page import as alias", () => {
        expect(
            new ExposedPageFinder(config).aliasFrom(
                {
                    file: "/project/node_modules/external-page/page.ts",
                    import: "external-page/page",
                    external: "external-page",
                },
                {name: "ignored"}
            )
        ).toBe("external-page/page");
    });
});
