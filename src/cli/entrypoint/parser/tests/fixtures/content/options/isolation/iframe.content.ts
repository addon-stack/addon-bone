import {ContentScriptIsolation, defineContentScriptAppend} from "adnbn";

export default defineContentScriptAppend({
    isolation: {type: ContentScriptIsolation.Iframe, height: 320},
});
