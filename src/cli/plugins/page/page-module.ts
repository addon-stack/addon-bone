export const PageModuleName = "#adnbn/page";

export const createPageModule = (aliases: Record<string, string>): string =>
    // Preserve own __proto__ keys and allow unused data to be removed from optimized bundles.
    `export const aliases = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(aliases))});\n`;
