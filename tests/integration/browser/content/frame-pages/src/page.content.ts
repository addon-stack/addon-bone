import {ContentScriptIsolation, defineContentScriptAppend} from "adnbn";

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/top.html"],
    isolation: {type: ContentScriptIsolation.Iframe, page: "panel"},
    container: {tagName: "section", className: "page-host"},

    boundary: ({boundary: frame}) => {
        frame.style.height = "250px";
        const onMessage = (event: MessageEvent) => {
            if (event.source === frame.contentWindow && event.data === "adnbn-page-ready") {
                frame.setAttribute("data-ready", "true");
            }
        };

        window.addEventListener("message", onMessage);

        return () => window.removeEventListener("message", onMessage);
    },
});
