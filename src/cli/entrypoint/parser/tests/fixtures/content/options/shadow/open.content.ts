import {ContentScriptShadowMode, defineContentScript} from "adnbn";
export default defineContentScript({isolation: {type: "shadow", mode: ContentScriptShadowMode.Open}});
