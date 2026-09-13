import {defineContentScriptAppend} from "adnbn";
const page = "panel";
const isolation = {type: "iframe", page, height: 320} as const;
export default defineContentScriptAppend({isolation});
