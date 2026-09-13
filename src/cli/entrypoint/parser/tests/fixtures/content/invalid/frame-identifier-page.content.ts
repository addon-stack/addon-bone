import {defineContentScriptAppend} from "adnbn";
// An unresolved identifier must not be confused with an alias that happens to have this name.
export default defineContentScriptAppend({isolation: {type: "iframe", page: panel}});
