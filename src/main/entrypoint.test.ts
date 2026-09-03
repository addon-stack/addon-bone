import {getEntrypointAssetsMap, getEntrypointAssets} from "./entrypoint";

import type {EntrypointAssetsMap, EntrypointAssets} from "@typing/entrypoint";

interface BuildAssetsGlobal {
    __webpack_require__?: ((moduleId: string | number) => unknown) & {
        __adnbnBuildAssets?: EntrypointAssetsMap;
        __adnbnCurrentEntrypointAssets?: EntrypointAssets;
    };
}

describe("getEntrypointAssetsMap", () => {
    const target = globalThis as BuildAssetsGlobal;
    const descriptor = Object.getOwnPropertyDescriptor(target, "__webpack_require__");

    afterEach(() => {
        if (descriptor) {
            Object.defineProperty(target, "__webpack_require__", descriptor);
        } else {
            Reflect.deleteProperty(target, "__webpack_require__");
        }
    });

    test("returns the map owned by the current bundle runtime", () => {
        const assets: EntrypointAssetsMap = {
            content: {
                initial: {js: ["content.js"], css: ["content.css"]},
                async: {js: ["lazy.js"], css: ["lazy.css"]},
                assets: ["image.png"],
            },
        };

        const runtime = () => undefined;
        runtime.__adnbnBuildAssets = assets;
        target.__webpack_require__ = runtime;

        expect(getEntrypointAssetsMap()).toBe(assets);
    });

    test("returns the current entrypoint assets from its own bundle runtime", () => {
        const assets: EntrypointAssets = {
            initial: {js: ["content.js"], css: ["content.css"]},
            async: {js: ["lazy.js"], css: ["lazy.css"]},
        };

        const runtime = () => undefined;
        runtime.__adnbnCurrentEntrypointAssets = assets;
        target.__webpack_require__ = runtime;

        expect(getEntrypointAssets()).toBe(assets);
    });

    test("fails clearly when a local runtime calls the background-only getter", () => {
        const runtime = () => undefined;
        runtime.__adnbnCurrentEntrypointAssets = {
            initial: {js: ["content.js"], css: []},
            async: {js: [], css: []},
        };
        target.__webpack_require__ = runtime;

        expect(() => getEntrypointAssetsMap()).toThrow(
            "getEntrypointAssetsMap() is available only in the background entrypoint"
        );
    });

    test("fails clearly when the current-entrypoint map is unavailable", () => {
        const runtime = () => undefined;
        runtime.__adnbnBuildAssets = {};
        target.__webpack_require__ = runtime;

        expect(() => getEntrypointAssets()).toThrow("Current entrypoint assets are unavailable in this runtime");
    });
});
