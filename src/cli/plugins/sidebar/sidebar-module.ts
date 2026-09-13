import type {ManifestSidebar} from "@typing/manifest";

export const SidebarModuleName = "#adnbn/sidebar";

export const createSidebarModule = (aliases: Record<string, ManifestSidebar>): string =>
    // Preserve own __proto__ keys and allow unused data to be removed from optimized bundles.
    `export const aliases = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(aliases))});\n`;
