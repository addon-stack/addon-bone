import {ContentScriptIsolation, ContentScriptShadowMode} from "adnbn";

export const options = {
    isolation: {type: ContentScriptIsolation.Shadow, mode: ContentScriptShadowMode.Closed},
    render: () => document.createElement("div"),
};
