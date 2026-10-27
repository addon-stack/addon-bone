import type {PopupAliasMap} from "@typing/popup";

export const PopupModuleName = "#adnbn/popup";

export const createPopupModule = (aliases: PopupAliasMap): string =>
    // Preserve own __proto__ keys and allow unused data to be removed from optimized bundles.
    `export const aliases = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(aliases))});\n`;
