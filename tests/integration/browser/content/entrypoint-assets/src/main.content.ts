import {defineContentScript} from "adnbn";

import {createProbe} from "./probe";

declare global {
    var __adnbnMainWorldVisibleToPage: boolean | undefined;
}

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    world: "MAIN",
    runAt: "document_start",
    allFrames: true,
    render() {
        globalThis.__adnbnMainWorldVisibleToPage = true;

        return createProbe("MAIN");
    },
});
