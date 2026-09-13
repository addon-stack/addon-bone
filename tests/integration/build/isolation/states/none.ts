import {defineContentScriptAppend} from "adnbn";
import "./watch.css";
export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    render: "Watch UI",
    main() {
        console.info("isolation-watch-none");
    },
});
