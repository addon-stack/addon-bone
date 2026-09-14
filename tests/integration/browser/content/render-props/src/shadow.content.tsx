import {defineContentScript} from "adnbn";
import {Panel} from "./shared/Panel";
import {prepare} from "./shared/prepare";
import {main} from "./shared/lifecycle";

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    anchor: ".react-anchor",
    isolation: {type: "shadow", mode: "closed"},
    prepare,
    main,
    render: Panel,
});
