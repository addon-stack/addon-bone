import "./resources/styles.css?asis";
import documentFile from "./resources/document.custom?browser";
import inline from "./resources/inline.woff2?base64";
import font from "./resources/direct.woff2";
import data from "./resources/data.json";
import {value} from "./resources/code.js?browser";
globalThis.resources = {documentFile, inline, font, data, value};
