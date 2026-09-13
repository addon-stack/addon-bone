import {getUrl} from "@addon-core/browser";

import {ContentScriptStylesRuntimeProperty, type ContentScriptStylesRuntime} from "@typing/content";

interface WebpackRuntime {
    (moduleId: string | number): unknown;
    [ContentScriptStylesRuntimeProperty]?: ContentScriptStylesRuntime;
}

declare const __webpack_require__: WebpackRuntime;

export const getContentScriptStylesRuntime = (): ContentScriptStylesRuntime => {
    const runtime =
        typeof __webpack_require__ === "function" ? __webpack_require__[ContentScriptStylesRuntimeProperty] : undefined;

    if (!runtime) {
        throw new Error("Isolated styles runtime is unavailable in this content entrypoint");
    }

    runtime.initialize(getUrl);

    return runtime;
};
