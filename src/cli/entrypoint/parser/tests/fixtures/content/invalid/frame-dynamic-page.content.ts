import {defineContentScriptAppend} from "adnbn";
export default defineContentScriptAppend({isolation: {type: "iframe", page: computeTarget()}});
