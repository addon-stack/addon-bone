import {defineOffscreen, OffscreenReason} from "adnbn";

export default defineOffscreen({
    name: "rootProbe",
    reasons: [OffscreenReason.DOMParser],
    justification: "Check offscreen entry resolution from an absolute project root.",
    init: () => ({
        read() {
            return "Offscreen root runtime";
        },
    }),
});
