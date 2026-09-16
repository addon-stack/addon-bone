import {defineContentScriptAppend} from "adnbn";
import {loadShared} from "./shared-lazy/loader";
import "./watch.css";

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    isolation: "shadow",
    render: "Watch UI",
    main() {
        console.info("isolation-watch-shadow-shared");

        return loadShared();
    },
});
