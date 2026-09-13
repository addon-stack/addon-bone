import {defineContentScriptAppend} from "adnbn";
export default defineContentScriptAppend({isolation: Math.random() ? "iframe" : "none"});
