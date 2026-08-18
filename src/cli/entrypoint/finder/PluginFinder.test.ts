import path from "path";

import PopupFinder from "./PopupFinder";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointFile} from "@typing/entrypoint";

const fixtures = path.resolve(__dirname, "tests", "fixtures", "precedence");

const pluginFile = (name: string): EntrypointFile => ({
    file: path.join(fixtures, "plugins", name, "popup.ts"),
    import: `${name}/popup`,
    external: name,
});

const makeFinder = (): PopupFinder => {
    const config = {
        app: "app",
        appSrcDir: ".",
        appsDir: "apps",
        debug: false,
        htmlDir: ".",
        mergePopup: true,
        multiplePopup: false,
        plugins: [],
        rootDir: path.join(fixtures, "project"),
        sharedDir: "shared",
        srcDir: "src",
    } as Partial<ReadonlyConfig> as ReadonlyConfig;
    const finder = new PopupFinder(config);

    config.plugins.push(
        {
            name: "first-plugin",
            popup: pluginFile("first-plugin"),
        },
        {
            name: "second-plugin",
            popup: pluginFile("second-plugin"),
        },
        {
            name: "adnbn:popup",
            popup: () => finder.files(),
        }
    );

    return finder;
};

describe("PluginFinder", () => {
    test("orders plugin, shared and app entrypoints from lowest to highest priority", async () => {
        const files = [...(await makeFinder().plugin().files())].map(({file}) =>
            file.startsWith(fixtures) ? path.relative(fixtures, file) : file
        );

        expect(files).toEqual([
            path.join("plugins", "first-plugin", "popup.ts"),
            path.join("plugins", "second-plugin", "popup.ts"),
            path.join("project", "src", "shared", "popup.ts"),
            path.join("project", "src", "apps", "app", "popup.ts"),
        ]);
    });
});
