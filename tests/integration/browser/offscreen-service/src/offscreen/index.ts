import {defineOffscreen, getService, OffscreenReason} from "adnbn";

export default defineOffscreen({
    name: "offscreenTest",
    reasons: [OffscreenReason.DOMParser],
    justification: "Use DOM APIs while exercising the offscreen-to-background service transport.",
    init: () => ({
        async callBackground() {
            return getService("offscreenTest").echo("ping");
        },
    }),
});
