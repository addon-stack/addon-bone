import {defineContentScript} from "adnbn";
import {createPanel} from "./panel";

export default defineContentScript({
    matches: ["http://127.0.0.1/*", "https://example.com/*"],
    world: "ISOLATED",
    render: () => createPanel("isolated"),
});
