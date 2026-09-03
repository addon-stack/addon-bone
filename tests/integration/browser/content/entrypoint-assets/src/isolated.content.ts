import {ContentScriptWorld, defineContentScript} from "adnbn";

import {createProbe} from "./probe";

declare global {
    var __adnbnIsolatedWorldVisibleToPage: boolean | undefined;
}

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    world: ContentScriptWorld.Isolated,
    runAt: "document_start",
    allFrames: true,
    render() {
        globalThis.__adnbnIsolatedWorldVisibleToPage = true;

        return createProbe("ISOLATED");
    },
});
