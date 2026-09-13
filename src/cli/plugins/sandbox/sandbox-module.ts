import type {SandboxParametersMap} from "@typing/sandbox";

export const SandboxModuleName = "#adnbn/sandbox";

export const createSandboxModule = (parameters: SandboxParametersMap): string =>
    // Preserve omitted optional values and allow unused data to be removed from optimized bundles.
    `export const parameters = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(parameters))});\n`;
