import {defineContentScript} from "adnbn";
import {loadShared} from "./shared-lazy/loader";

export default defineContentScript({
    matches: ["https://example.com/*"],
    main: loadShared,
});
