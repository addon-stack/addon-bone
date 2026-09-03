import {defineBackground, getEntrypointAssetsMap} from "adnbn";

declare global {
    var __adnbnContentBuildAssetsBackgroundReady: boolean | undefined;
}

export default defineBackground({
    main() {
        const assets = getEntrypointAssetsMap();
        const expectedEntries = [
            "background",
            "isolated-secondary.content",
            "isolated.content",
            "main-secondary.content",
            "main.content",
        ];

        globalThis.__adnbnContentBuildAssetsBackgroundReady =
            Object.keys(assets).length === expectedEntries.length && expectedEntries.every(entry => entry in assets);
    },
});
