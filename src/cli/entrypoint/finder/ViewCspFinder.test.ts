import path from "path";

import Page from "@cli/plugins/page/Page";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "tests", "fixtures", "view-csp");

const config = {
    app: "app",
    appSrcDir: ".",
    appsDir: "apps",
    debug: false,
    htmlDir: ".",
    mergePages: true,
    plugins: [
        {
            name: path.join(rootDir, "src"),
            page: "page.ts",
        },
    ],
    rootDir,
    sharedDir: ".",
    srcDir: "src",
} as ReadonlyConfig;

describe("ViewCspFinder", () => {
    test("collects CSP for manifest and keeps it out of HTML tag options", async () => {
        const page = new Page(config);

        await expect(page.csp()).resolves.toEqual([
            {
                sources: {
                    connect: ["https://api.example.com"],
                },
            },
        ]);

        await expect(page.view().tags()).resolves.toEqual([
            {
                files: ["page.html"],
                name: "help",
            },
        ]);
    });
});
