import {defineContentScriptAppend} from "adnbn";
import {Panel} from "./shared/Panel";
import {prepare} from "./shared/prepare";
import {main} from "./shared/lifecycle";

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    anchor: "#frame",
    isolation: "iframe",
    prepare,
    main,
    render: Panel,
});
