import {defineContentScript} from "adnbn";
export default defineContentScript({isolation: {type: "shadow", mode: Math.random() > 0.5 ? "open" : "closed"}});
