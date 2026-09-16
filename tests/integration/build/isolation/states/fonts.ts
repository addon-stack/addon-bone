import {defineContentScriptAppend} from "adnbn";
import "./watch.css";
import "./watch-fonts.css";

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    isolation: "iframe",
    render: "Watch UI",
    main() {
        console.info("isolation-watch-fonts");
    },
});
