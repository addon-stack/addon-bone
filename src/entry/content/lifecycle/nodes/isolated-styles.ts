import {getUrl} from "@addon-core/browser";
import {readContentStyles} from "#adnbn/runtime";

import type {ContentScriptStylesRuntime} from "@typing/content";

export const getContentScriptStylesRuntime = (): ContentScriptStylesRuntime => {
    const runtime = readContentStyles();

    if (!runtime) {
        throw new Error("Isolated styles runtime is unavailable in this content entrypoint");
    }

    runtime.initialize(getUrl);

    return runtime;
};
