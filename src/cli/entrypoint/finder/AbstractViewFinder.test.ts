import path from "path";

import PopupFinder from "./PopupFinder";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "tests", "fixtures", "selection");

const makeFinder = (multiplePopup: boolean): PopupFinder => {
    const config = {
        app: "myapp",
        appSrcDir: ".",
        appsDir: "apps",
        debug: false,
        htmlDir: ".",
        mergePopup: false,
        multiplePopup,
        plugins: [],
        rootDir,
        sharedDir: ".",
        srcDir: "src",
    } as Partial<ReadonlyConfig> as ReadonlyConfig;

    const finder = new PopupFinder(config);

    config.plugins.push({name: "adnbn:popup", popup: () => finder.files()});

    return finder;
};

describe("AbstractViewFinder selected options", () => {
    test("reports every built view when several are allowed, including one that is not applied by default", async () => {
        await expect(makeFinder(true).selectedOptions()).resolves.toMatchObject([
            {title: "Main popup"},
            {title: "Settings popup", apply: false},
        ]);
    });

    test("reports only the winning candidate when a single view is allowed", async () => {
        const selected = await makeFinder(false).selectedOptions();

        expect(selected).toHaveLength(1);
        expect(selected).toMatchObject([{title: "Settings popup"}]);
    });
});
