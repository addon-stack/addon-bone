/** @jest-environment node */

import path from "path";

import type {Compiler, EntryNormalized} from "@rspack/core";

import EntrypointPlugin from "./EntrypointPlugin";

class TestEntrypointPlugin extends EntrypointPlugin {
    public applyEntryOptions(entry: EntryNormalized): void {
        this.hookEntryOption(entry);
    }

    public applyWatch(compiler: Compiler): Promise<void> {
        return this.hookWatchRun(compiler);
    }
}

test("applies entry options while preserving existing entry configuration", () => {
    const plugin = new TestEntrypointPlugin(
        new Map([
            [
                "example.content",
                new Set([
                    {
                        file: "example.content.ts",
                        import: "src/example.content.ts",
                    },
                ]),
            ],
        ])
    ).entryOptions({
        asyncChunks: false,
        publicPath: "",
    });
    const entry = {
        "example.content": {
            import: ["existing.js"],
            filename: "custom/[name].js",
            asyncChunks: true,
            publicPath: "auto",
        },
    } as EntryNormalized;

    plugin.applyEntryOptions(entry);

    expect(entry["example.content"]).toMatchObject({
        import: ["existing.js", path.join("virtual", "example.content.ts")],
        filename: "custom/[name].js",
        asyncChunks: false,
        publicPath: "",
    });
});

test("resolves entry options independently for each entrypoint", () => {
    const entryFile = (name: string) => ({
        file: `${name}.ts`,
        import: `src/${name}.ts`,
    });
    const plugin = new TestEntrypointPlugin(
        new Map([
            ["isolated.content", new Set([entryFile("isolated.content")])],
            ["main.content", new Set([entryFile("main.content")])],
        ])
    ).entryOptions(name => ({
        asyncChunks: name !== "main.content",
        layer: name === "main.content" ? "adnbn:content:main" : "adnbn:content:isolated",
        publicPath: "",
    }));
    const entry = {
        "isolated.content": ["isolated.js"],
        "main.content": ["main.js"],
    } as EntryNormalized;

    plugin.applyEntryOptions(entry);

    expect(entry["isolated.content"]).toMatchObject({
        asyncChunks: true,
        layer: "adnbn:content:isolated",
        publicPath: "",
    });
    expect(entry["main.content"]).toMatchObject({
        asyncChunks: false,
        layer: "adnbn:content:main",
        publicPath: "",
    });
});

test("refreshes entry options during watch when virtual modules stay unchanged", async () => {
    const entries = new Map([
        [
            "example.content",
            new Set([
                {
                    file: "example.content.ts",
                    import: "src/example.content.ts",
                },
            ]),
        ],
    ]);
    let world: "ISOLATED" | "MAIN" = "ISOLATED";
    const plugin = new TestEntrypointPlugin(entries)
        .entryOptions(() => ({
            asyncChunks: world === "ISOLATED",
            layer: `adnbn:content:${world.toLowerCase()}`,
        }))
        .watch(async () => entries);
    const entry = {"example.content": ["existing.js"]} as EntryNormalized;

    plugin.applyEntryOptions(entry);
    world = "MAIN";

    await plugin.applyWatch({
        context: process.cwd(),
        modifiedFiles: new Set(["example.content.ts"]),
        options: {entry},
    } as unknown as Compiler);

    expect(entry["example.content"]).toMatchObject({
        asyncChunks: false,
        layer: "adnbn:content:main",
    });
});
