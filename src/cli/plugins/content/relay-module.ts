import type {RelayOptions} from "@typing/relay";

export const RelayModuleName = "#adnbn/relay";

export const createRelayModule = (options: Record<string, RelayOptions>): string =>
    // Preserve the JSON payload, including omitted optional values, without retaining unused data.
    `export const options = /*#__PURE__*/ JSON.parse(${JSON.stringify(JSON.stringify(options))});\n`;
