import {defineContentScript} from "adnbn";

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    world: "ISOLATED",
    runAt: "document_start",
    allFrames: true,
    main() {
        const root = document.documentElement;
        root.dataset.adnbnIsolatedSecondaryRuns = String(Number(root.dataset.adnbnIsolatedSecondaryRuns ?? "0") + 1);
    },
});
