import {defineContentScript} from "adnbn";
export default defineContentScript({isolation: {type: Math.random() > 0.5 ? "shadow" : "iframe"}});
