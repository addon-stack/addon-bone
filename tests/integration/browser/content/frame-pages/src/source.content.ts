import {ContentScriptIsolation, ContentScriptWorld, defineContentScriptAppend} from "adnbn";
export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/top.html"],
    world: ContentScriptWorld.Main,
    isolation: {type: ContentScriptIsolation.Iframe, src: "http://127.0.0.1:1/page.html", height: 200},
    container: {tagName: "section", className: "source-host"},
    main() {
        window.addEventListener("message", event => {
            const frame = document.querySelector<HTMLIFrameElement>(".source-host iframe");
            if (event.source === frame?.contentWindow && event.data === "adnbn-source-ready")
                frame!.setAttribute("data-ready", "true");
        });
    },
});
