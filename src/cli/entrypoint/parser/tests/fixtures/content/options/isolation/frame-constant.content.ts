import {defineContentScriptAppend} from "adnbn";
const page = "panel";
const isolation = {type: "iframe", page} as const;
export default defineContentScriptAppend({isolation});
