import ViewCspFinder from "./ViewCspFinder";

import {EntrypointFile, EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";
import {CspConfig} from "@typing/csp";
import type {ViewEntrypointOptions} from "@typing/view";
import type {ReadonlyConfig} from "@typing/config";

const config = {
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
} as Partial<ReadonlyConfig> as ReadonlyConfig;

type CspViewOptions = ViewEntrypointOptions & {csp?: CspConfig};

class TestViewCspFinder extends ViewCspFinder<CspViewOptions, CspConfig> {
    public constructor(
        config: ReadonlyConfig,
        private readonly pluginOptions: Map<EntrypointFile, CspViewOptions>
    ) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Page;
    }

    protected getParser(): EntrypointParser<CspViewOptions> {
        throw new Error("Parser should not be used in ViewCspFinder tests.");
    }

    protected getPlugin(): EntrypointOptionsFinder<CspViewOptions> {
        return createPlugin(this.pluginOptions);
    }
}

const file = (name: string): EntrypointFile => ({
    file: `/project/src/${name}`,
    import: `@/${name}`,
});

const createPlugin = (options: Map<EntrypointFile, CspViewOptions>): EntrypointOptionsFinder<CspViewOptions> => ({
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

describe("ViewCspFinder", () => {
    test("collects CSP for manifest and keeps it out of HTML tag options", async () => {
        const page = new TestViewCspFinder(
            config,
            new Map<EntrypointFile, CspViewOptions>([
                [
                    file("page.ts"),
                    {
                        title: "Help",
                        csp: {
                            sources: {
                                connect: ["https://api.example.com"],
                            },
                        },
                    },
                ],
            ])
        );

        await expect(page.csp()).resolves.toEqual([
            {
                sources: {
                    connect: ["https://api.example.com"],
                },
            },
        ]);

        await expect(page.views()).resolves.toMatchObject(
            new Map([
                [
                    "page",
                    {
                        options: {
                            title: "Help",
                        },
                    },
                ],
            ])
        );

        const [view] = (await page.views()).values();

        expect(view.options).not.toHaveProperty("csp");
    });

    test("ignores entries without CSP", async () => {
        const page = new TestViewCspFinder(
            config,
            new Map<EntrypointFile, CspViewOptions>([[file("page.ts"), {title: "Help"}]])
        );

        await expect(page.csp()).resolves.toEqual([]);
    });
});
