import {defineContentScriptAppend} from "adnbn";
const alias = "panel";
export default defineContentScriptAppend({isolation: {type: "iframe", page: alias, width: "80%"}});
