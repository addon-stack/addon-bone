import {defineRelay} from "adnbn";
export default defineRelay({
    name: "control",
    matches: ["http://127.0.0.1/*"],
    isolation: {type: "iframe", page: "control"},
    container: {tagName: "section", className: "control-host"},
    init: () => ({
        // An explicit serializable value keeps the readiness probe false until the page reports its CSS.
        pageColor: () => document.querySelector<HTMLIFrameElement>(".control-host iframe")?.dataset.color ?? null,
        report(result: object) {
            document.querySelector<HTMLElement>(".control-host")!.dataset.result = JSON.stringify(result);
        },
    }),
    main() {
        window.addEventListener("message", event => {
            const frame = document.querySelector<HTMLIFrameElement>(".control-host iframe");
            if (event.source === frame?.contentWindow && event.data?.type === "relay-page-color")
                frame!.dataset.color = event.data.color;
        });
    },
});
