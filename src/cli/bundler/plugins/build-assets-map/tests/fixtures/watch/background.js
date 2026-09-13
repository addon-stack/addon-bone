import {getEntrypointAssetsMap} from "adnbn";

globalThis.readFull = () => getEntrypointAssetsMap();
