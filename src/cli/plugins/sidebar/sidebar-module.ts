import type {SidebarAliasMap} from "@typing/sidebar";

export const SidebarModuleName = "#adnbn/sidebar";

export const createSidebarModule = (aliases: SidebarAliasMap): string =>
    // Preserve own __proto__ keys and allow unused data to be removed from optimized bundles.
    `export const aliases = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(aliases))});\n`;
