import {ContentScriptIsolation, ContentScriptAppend, ContentScriptWorld, defineContentScriptAppend} from "adnbn";
import "./fonts.css?unisolated&asis";
import {Panel} from "../shared/panel/Panel";

let instance = 0;

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    world: ContentScriptWorld.Isolated,
    runAt: "document_end",
    allFrames: true,
    anchor: "[data-shadow-primary]",
    append: ContentScriptAppend.Last,
    watch: true,
    isolation: ContentScriptIsolation.Shadow,
    container: ({anchor}) => {
        const host = document.createElement("section");
        host.dataset.shadowProbe = "primary";
        host.dataset.anchor = anchor.getAttribute("data-shadow-primary") ?? "unknown";
        host.dataset.instance = String(++instance);

        return host;
    },
    render: Panel,
});
