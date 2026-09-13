export const IconModuleName = "#adnbn/icon";

export const createIconModule = (groups: Record<string, Record<number, string>>): string =>
    // Preserve own __proto__ keys and allow unused data to be removed from optimized bundles.
    `export const groups = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(groups))});\n`;
