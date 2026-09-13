import {getEntrypointAssetsMap} from "adnbn";

globalThis.__backgroundBuildAssets = getEntrypointAssetsMap();
globalThis.loadBackgroundFixture = () => import(/* webpackChunkName: "background-lazy" */ "./alpha.lazy.js");
