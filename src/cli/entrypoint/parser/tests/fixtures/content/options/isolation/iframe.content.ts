import {ContentScriptIsolation, defineContentScriptAppend} from "adnbn";

export default defineContentScriptAppend({
    boundary: ({boundary}) => {
        boundary.style.height = "320px";
    },
    isolation: {type: ContentScriptIsolation.Iframe},
});
