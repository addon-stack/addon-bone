import {getEntrypointAssetsMap, getEntrypointAssets} from "adnbn";

const traceGetter = getter => {
    try {
        return {ok: true, value: getter()};
    } catch (error) {
        return {error: error instanceof Error ? error.message : String(error), ok: false};
    }
};

globalThis.__backgroundBuildAssets = getEntrypointAssetsMap();
globalThis.__buildAssetsGetterTrace = {
    current: traceGetter(getEntrypointAssets),
    full: traceGetter(getEntrypointAssetsMap),
};
