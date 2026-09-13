import {defineContentScript} from "adnbn";

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    world: "MAIN",
    runAt: "document_start",
    allFrames: true,
    main() {
        const root = document.documentElement;
        root.dataset.adnbnMainSecondaryRuns = String(Number(root.dataset.adnbnMainSecondaryRuns ?? "0") + 1);
    },
});
