import type {ManifestPopup} from "@typing/manifest";

export const PopupModuleName = "#adnbn/popup";

export const createPopupModule = (aliases: Record<string, ManifestPopup>): string =>
    // Preserve own __proto__ keys and allow unused data to be removed from optimized bundles.
    `export const aliases = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(aliases))});\n`;
