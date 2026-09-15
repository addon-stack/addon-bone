import {defineContentScriptAppend} from "adnbn";
import "./watch.css?isolation";
export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    isolation: {type: "iframe"},
    boundary: ({boundary}) => {
        boundary.style.height = "220px";
    },
    render: "Watch UI",
    main() {
        console.info("isolation-watch-iframe");
    },
});
