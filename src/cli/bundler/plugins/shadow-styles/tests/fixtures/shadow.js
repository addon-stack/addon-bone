import "./shadow.css";

globalThis.getShadowStylesRuntime = () => __webpack_require__.__adnbnShadowStyles;
globalThis.loadShadowStyles = () => import(/* webpackChunkName: "shadow-lazy" */ "./shadow.lazy.js");
