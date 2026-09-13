import {defineContentScript, type ContentScriptIsolationOptions} from "adnbn";
const isolation = {type: "shadow", mode: "closed"} as const satisfies ContentScriptIsolationOptions;
export default defineContentScript({isolation: isolation satisfies ContentScriptIsolationOptions});
