import {getEntrypointAssetsMap, getEntrypointAssets} from "adnbn";

import "./alpha.css";
import payload from "./payload.js?resource";
import {shared} from "./shared.js";

const traceGetter = getter => {
    try {
        return {ok: true, value: getter()};
    } catch (error) {
        return {error: error instanceof Error ? error.message : String(error), ok: false};
    }
};

globalThis.__alphaEntrypointAssets = getEntrypointAssets();
globalThis.__buildAssetsGetterTrace = {
    current: traceGetter(getEntrypointAssets),
    full: traceGetter(getEntrypointAssetsMap),
};
globalThis.__alphaPayload = payload;
globalThis.__alphaShared = shared;
globalThis.loadAlphaFixture = () => import(/* webpackChunkName: "alpha-lazy" */ "./alpha.lazy.js");
