import {getEntrypointAssetsMap} from "adnbn";

import {shared} from "./shared.js";

globalThis.__backgroundBuildAssets = getEntrypointAssetsMap();
globalThis.__backgroundShared = shared;
