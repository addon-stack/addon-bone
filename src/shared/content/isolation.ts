import {
    ContentScriptIsolation,
    ContentScriptShadowMode,
    type ContentScriptIsolationOptions,
    type ContentScriptIsolationFrameOptions,
    type ContentScriptFramePageOptions,
    type ContentScriptFrameSourceOptions,
} from "@typing/content";

export const isContentScriptFrameNavigation = (
    isolation: unknown
): isolation is ContentScriptIsolationFrameOptions &
    (ContentScriptFramePageOptions | ContentScriptFrameSourceOptions) =>
    !!isolation &&
    typeof isolation === "object" &&
    "type" in isolation &&
    isolation.type === ContentScriptIsolation.Iframe &&
    (("page" in isolation && isolation.page !== undefined) || ("src" in isolation && isolation.src !== undefined));

/** Pure normalization and structural validation, shared by CLI and runtime. */
export const resolveContentScriptIsolation = (value: unknown, hasRender = false): ContentScriptIsolationOptions => {
    const options =
        value === undefined ? {type: ContentScriptIsolation.None} : typeof value === "string" ? {type: value} : value;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
        throw new Error("isolation must be none, shadow, iframe, or an options object with type");
    }
    const {type, mode, page, src, width, height} = options as Record<string, unknown>;
    if (!Object.values(ContentScriptIsolation).includes(type as ContentScriptIsolation)) {
        throw new Error(
            "isolation.type must be a statically known ContentScriptIsolation value: none, shadow or iframe"
        );
    }
    const keys =
        type === ContentScriptIsolation.Shadow
            ? ["type", "mode"]
            : type === ContentScriptIsolation.Iframe
              ? ["type", "page", "src", "width", "height"]
              : ["type"];
    for (const key of Object.keys(options)) {
        if (!keys.includes(key)) throw new Error(`isolation.${key} is not supported for isolation type "${type}"`);
    }
    if (type === ContentScriptIsolation.None) return {type};
    if (type === ContentScriptIsolation.Shadow) {
        if (mode !== undefined && !Object.values(ContentScriptShadowMode).includes(mode as ContentScriptShadowMode)) {
            throw new Error('isolation.mode must be "open" or "closed"');
        }
        return {type, mode: (mode as ContentScriptShadowMode | undefined) ?? ContentScriptShadowMode.Open};
    }
    if (page !== undefined && src !== undefined)
        throw new Error("isolation.page and isolation.src are mutually exclusive");
    if (page !== undefined && (typeof page !== "string" || !page.trim()))
        throw new Error("isolation.page must be a statically known page alias");
    if (src !== undefined) {
        if (typeof src !== "string" || !/^(https?|chrome-extension|moz-extension):\/\//.test(src)) {
            throw new Error("isolation.src must be an absolute HTTP(S) or extension URL");
        }
        try {
            new URL(src);
        } catch {
            throw new Error("isolation.src must be a valid absolute URL");
        }
    }
    if ((page !== undefined || src !== undefined) && hasRender) {
        throw new Error(
            "isolation.page/isolation.src cannot be combined with render; the embedded page owns its UI and resources"
        );
    }
    for (const [name, size] of [
        ["width", width],
        ["height", height],
    ] as const) {
        if (
            size !== undefined &&
            !(
                (typeof size === "number" && Number.isFinite(size) && size >= 0) ||
                (typeof size === "string" && size.trim())
            )
        ) {
            throw new Error(`isolation.${name} must be pixels or a CSS size`);
        }
    }
    if (typeof height === "string" && height.trim().toLowerCase() === "auto") {
        throw new Error('isolation.height: "auto" is not supported yet; specify an explicit height');
    }
    return {
        type,
        width: width ?? "100%",
        height: height ?? 150,
        ...(page === undefined ? {} : {page}),
        ...(src === undefined ? {} : {src}),
    } as ContentScriptIsolationFrameOptions;
};
