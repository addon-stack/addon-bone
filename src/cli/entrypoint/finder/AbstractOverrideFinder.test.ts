import path from "path";

import BookmarksFinder from "./BookmarksFinder";
import HistoryFinder from "./HistoryFinder";
import NewtabFinder from "./NewtabFinder";

import {toPosix} from "@cli/utils/path";

import type {ReadonlyConfig} from "@typing/config";
import type {EntrypointFile} from "@typing/entrypoint";

const fixtures = path.resolve(__dirname, "tests", "fixtures", "override");
const workspace = path.join(fixtures, "workspace");

const makeConfig = (overrides: Partial<ReadonlyConfig> = {}): ReadonlyConfig => {
    return {
        app: "app",
        appSrcDir: ".",
        appsDir: "apps",
        debug: false,
        htmlDir: ".",
        plugins: [],
        rootDir: workspace,
        sharedDir: "shared",
        srcDir: "src",
        ...overrides,
    } as Partial<ReadonlyConfig> as ReadonlyConfig;
};

const relativeFiles = (root: string, files: Iterable<EntrypointFile>): string[] => {
    return Array.from(files, ({file}) => toPosix(path.relative(root, file)));
};

describe.each([
    {type: "newtab", Finder: NewtabFinder},
    {type: "bookmarks", Finder: BookmarksFinder},
    {type: "history", Finder: HistoryFinder},
] as const)("$type finder", ({type, Finder}) => {
    const makeFinder = (overrides: Partial<ReadonlyConfig> = {}) => {
        const config = makeConfig(overrides);
        const finder = new Finder(config);

        config.plugins.push(
            {
                name: "third-party",
                [type]: {
                    file: path.join(workspace, "plugins", "third-party", `${type}.ts`),
                    import: `third-party/${type}`,
                    external: "third-party",
                },
            },
            {
                name: "adnbn:override",
                [type]: () => finder.files(),
            }
        );

        return finder;
    };

    test("discovers named files and index directories of a single-app project", async () => {
        const rootDir = path.join(fixtures, "discovery", type);
        const finder = new Finder(makeConfig({rootDir, sharedDir: "."}));

        expect(relativeFiles(path.join(rootDir, "src"), await finder.files()).sort()).toEqual([
            `account.${type}.tsx`,
            `advanced.${type}/index.tsx`,
            `${type}.ts`,
            `${type}/index.ts`,
        ]);
    });

    test("replaces the shared candidate with the app one instead of merging them", async () => {
        expect(relativeFiles(workspace, await makeFinder().files())).toEqual([`src/apps/app/${type}.ts`]);
    });

    test("falls back to the shared candidate for an app without its own", async () => {
        expect(relativeFiles(workspace, await makeFinder({app: "other"}).files())).toEqual([`src/shared/${type}.ts`]);
    });

    test("turns only the highest-precedence candidate into a view with its CSP", async () => {
        const finder = makeFinder();

        expect(relativeFiles(workspace, await finder.plugin().files())).toEqual([
            `plugins/third-party/${type}.ts`,
            `src/apps/app/${type}.ts`,
        ]);

        const views = await finder.views();

        expect([...views.keys()]).toEqual([type]);
        expect(views.get(type)).toMatchObject({
            alias: type,
            filename: `${type}.html`,
            file: {file: path.join(workspace, "src", "apps", "app", `${type}.ts`)},
            options: {title: `App ${type}`},
        });
        await expect(finder.csp()).resolves.toEqual([{sources: {connect: ["https://app.example.com"]}}]);
    });

    test("uses the plugin candidate when the workspace has none", async () => {
        const finder = makeFinder({srcDir: "missing"});
        const [view] = (await finder.views()).values();

        expect(view).toMatchObject({
            alias: `third-party/${type}`,
            filename: `${type}.html`,
            options: {title: `Plugin ${type}`},
        });
        await expect(finder.csp()).resolves.toEqual([{sources: {connect: ["https://plugin.example.com"]}}]);
    });
});
