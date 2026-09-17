import {readAssets, readContentStyles} from "#adnbn/runtime";
import {Panel, libraries} from "./Panel.js";
import "./document.scss?unisolated";

globalThis.deliveryProbe = {
    Panel,
    libraries,
    assets: readAssets,
    styles: readContentStyles,
    load: () => import("./lazy.js"),
};
