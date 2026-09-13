import {defineContentScriptAppend} from "adnbn";
import "./watch.css?isolation";
import "./watch-fonts.css?isolation";
export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    isolation: "iframe",
    render: "Watch UI",
    main() {
        console.info("isolation-watch-fonts");
    },
});
