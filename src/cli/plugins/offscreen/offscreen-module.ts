import type {OffscreenParametersMap} from "@typing/offscreen";

export const OffscreenModuleName = "#adnbn/offscreen";

export const createOffscreenModule = (parameters: OffscreenParametersMap): string =>
    // Preserve the JSON payload without retaining unused data.
    `export const parameters = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(parameters))});\n`;
