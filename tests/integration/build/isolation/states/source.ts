import {defineContentScriptAppend} from "adnbn";
import "./watch.css";
export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    isolation: {type: "iframe", src: "https://example.com/widget"},
    main() {
        console.info("isolation-watch-source");
    },
});
