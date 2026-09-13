import "./normal.css";

globalThis.loadNormalStyles = () => import(/* webpackChunkName: "normal-lazy" */ "./normal.lazy.js");
