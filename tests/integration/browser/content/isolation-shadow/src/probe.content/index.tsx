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
    boundary: ({boundary, container}) => {
        const observer = new MutationObserver(records => {
            if (!records.some(record => record.target.parentNode === boundary && record.addedNodes.length)) {
                return;
            }

            const links = Array.from(boundary.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
            container.setAttribute(
                "data-styled-first-render",
                String(links.length > 0 && links.every(link => link.sheet))
            );
            observer.disconnect();
        });

        observer.observe(boundary, {childList: true, subtree: true});

        return () => observer.disconnect();
    },
    container: ({anchor}) => {
        const host = document.createElement("section");
        host.dataset.shadowProbe = "primary";
        host.dataset.anchor = anchor.getAttribute("data-shadow-primary") ?? "unknown";
        host.dataset.instance = String(++instance);

        return host;
    },
    render: Panel,
});
