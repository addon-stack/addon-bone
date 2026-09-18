import path from "path";

import View from "./View";

import {PopupFinder} from "@cli/entrypoint";

import {Mode} from "@typing/app";
import {Browser} from "@typing/browser";
import type {ReadonlyConfig} from "@typing/config";

const fixtures = path.resolve(__dirname, "tests", "fixtures");

const makeView = (fixture: string) => {
    const config = {
        app: "myapp",
        appSrcDir: ".",
        appsDir: "apps",
        browser: Browser.Chrome,
        debug: false,
        htmlDir: "pages",
        manifestVersion: 3,
        mergePopup: false,
        mode: Mode.Production,
        multiplePopup: false,
        plugins: [],
        rootDir: path.join(fixtures, fixture),
        sharedDir: ".",
        srcDir: "src",
    } as Partial<ReadonlyConfig> as ReadonlyConfig;

    const finder = new PopupFinder(config);

    config.plugins.push({name: "adnbn:popup", popup: () => finder.files()});

    return new View(config, finder);
};

describe("View", () => {
    test("passes only HTML options to the tags plugin", async () => {
        await expect(makeView("html-options").tags()).resolves.toEqual([
            {
                links: "popup.css",
                metas: {attributes: {name: "viewport", content: "width=device-width"}},
                files: ["pages/popup.html"],
            },
        ]);
    });

    test("adds no tags for a view whose options only configure the view, the build or the manifest", async () => {
        await expect(makeView("no-html-options").tags()).resolves.toEqual([]);
    });
});
