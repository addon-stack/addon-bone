import type {AssetInfo, PathData} from "@rspack/core";

import {appFilenameResolver} from "./output";

describe("appFilenameResolver", () => {
    test("preserves string templates while resolving the app and directory", () => {
        expect(appFilenameResolver("Build Assets", "[name].[app].[fullhash:8].js", "custom/js")).toBe(
            "custom/js/[name].build-assets.[fullhash:8].js"
        );
    });

    test("preserves user callbacks and resolves their returned template", () => {
        const pathData = {id: "entry"} as PathData;
        const assetInfo = {} as AssetInfo;
        const filename = jest.fn((_pathData: PathData, _assetInfo?: AssetInfo) => {
            return "[name].[app].[contenthash:8].js";
        });
        const resolver = appFilenameResolver("Build Assets", filename, "custom/js");

        expect(typeof resolver).toBe("function");
        expect((resolver as typeof filename)(pathData, assetInfo)).toBe(
            "custom/js/[name].build-assets.[contenthash:8].js"
        );
        expect(filename).toHaveBeenCalledWith(pathData, assetInfo);
    });
});
