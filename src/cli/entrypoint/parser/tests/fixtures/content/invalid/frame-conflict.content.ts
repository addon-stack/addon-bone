import {defineContentScriptAppend} from "adnbn";
export default defineContentScriptAppend({isolation: {type: "iframe", page: "panel", src: "https://example.com"}});
