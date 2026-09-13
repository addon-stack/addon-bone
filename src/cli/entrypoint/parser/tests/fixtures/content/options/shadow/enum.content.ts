import {ContentScriptIsolation, ContentScriptShadowMode, defineContentScriptAppend} from "adnbn";
export default defineContentScriptAppend({
    isolation: {type: ContentScriptIsolation.Shadow, mode: ContentScriptShadowMode.Closed},
    render: "Panel",
});
