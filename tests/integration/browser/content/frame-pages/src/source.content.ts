import {ContentScriptIsolation, ContentScriptWorld, defineContentScriptAppend} from "adnbn";

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/top.html"],
    world: ContentScriptWorld.Main,
    isolation: {type: ContentScriptIsolation.Iframe, src: "http://127.0.0.1:1/page.html"},
    container: {tagName: "section", className: "source-host"},

    boundary: ({boundary: frame}) => {
        frame.style.height = "200px";
        const onMessage = (event: MessageEvent) => {
            if (event.source === frame.contentWindow && event.data === "adnbn-source-ready") {
                frame.setAttribute("data-ready", "true");
            }
        };

        window.addEventListener("message", onMessage);

        return () => window.removeEventListener("message", onMessage);
    },
});
