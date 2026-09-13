import {ContentScriptIsolation, defineContentScriptAppend} from "adnbn";

export default defineContentScriptAppend({
    isolation: {
        type: ContentScriptIsolation.Iframe,
        src: "https://example.com/panel",
        width: 0,
        height: "calc(100vh - 24px)",
    },
});
