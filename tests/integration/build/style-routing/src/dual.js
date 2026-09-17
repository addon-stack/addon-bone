import {getEntrypointAssets} from "adnbn";
import isolated from "./dual.module.scss";
import document from "./dual.module.scss?unisolated";

globalThis.dualClasses = {isolated: isolated.dual, document: document.dual};

globalThis.dualAssets = getEntrypointAssets();

globalThis.loadDual = () => import("./dual-lazy.js");
