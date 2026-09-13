import {defineContentScript} from "adnbn";
export default defineContentScript({isolation: {type: "iframe", height: 200, mode: "closed"}});
