import {getEntrypointAssets} from "adnbn";
import "./alpha.css";
import payload from "./payload.js?resource";
import {shared} from "./shared.js";

globalThis.__alphaPayload = payload;
globalThis.__alphaShared = shared;
