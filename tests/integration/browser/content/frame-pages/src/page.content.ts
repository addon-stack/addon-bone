import {ContentScriptIsolation, defineContentScriptAppend} from "adnbn";
export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/top.html"],
    isolation: {type: ContentScriptIsolation.Iframe, page: "panel", height: 250},
    container: {tagName: "section", className: "page-host"},
    main() {
        window.addEventListener("message", event => {
            const frame = document.querySelector<HTMLIFrameElement>(".page-host iframe");
            if (event.source === frame?.contentWindow && event.data === "adnbn-page-ready")
                frame!.setAttribute("data-ready", "true");
        });
    },
});
