import {ContentScriptIsolation, ContentScriptShadowMode, defineRelay} from "adnbn";
export default defineRelay({
    isolation: {type: ContentScriptIsolation.Shadow, mode: ContentScriptShadowMode.Closed},
    init: () => ({}),
    render: "Panel",
});
