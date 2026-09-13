import {defineContentScriptAppend} from "adnbn";
export default defineContentScriptAppend({isolation: {type: "iframe", src: computeTarget()}});
