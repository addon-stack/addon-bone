import {Browser, ContentScriptIsolation, defineContentScript} from "adnbn";
import {closed, runtime} from "./settings";

const defaults = {type: ContentScriptIsolation.Shadow, mode: "open"};
export default defineContentScript({
    ...runtime,
    isolation: {...defaults, mode: closed},
    includeBrowser: [Browser.Firefox, ...[Browser.Chrome]],
    main() {
        throw new Error("The build must never execute entrypoint code");
    },
});
