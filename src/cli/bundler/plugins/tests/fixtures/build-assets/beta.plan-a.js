import {getEntrypointAssetsMap, getEntrypointAssets} from "adnbn";

import "./beta.css";
import {shared} from "./shared.js";

const traceGetter = getter => {
    try {
        return {ok: true, value: getter()};
    } catch (error) {
        return {error: error instanceof Error ? error.message : String(error), ok: false};
    }
};

globalThis.__betaEntrypointAssets = getEntrypointAssets();
globalThis.__buildAssetsGetterTrace = {
    current: traceGetter(getEntrypointAssets),
    full: traceGetter(getEntrypointAssetsMap),
};
globalThis.__betaShared = shared;
globalThis.loadBetaFixture = () => import(/* webpackChunkName: "beta-lazy" */ "./beta.lazy.js");
