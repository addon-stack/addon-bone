import {defineOffscreen, OffscreenReason} from "adnbn";

export default defineOffscreen({
    name: "dataOffscreen",
    reasons: [OffscreenReason.DOMParser],
    justification: "Offscreen data",
    init: () => ({ping: () => true}),
});
