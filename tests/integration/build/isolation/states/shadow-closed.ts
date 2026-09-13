import {ContentScriptIsolation, ContentScriptShadowMode, defineContentScriptAppend} from "adnbn";
import "./watch.css?isolation";
export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    isolation: {type: ContentScriptIsolation.Shadow, mode: ContentScriptShadowMode.Closed},
    render: "Watch UI",
    main() {
        console.info("isolation-watch-shadow-closed");
    },
});
