import {RuntimeGlobals} from "@rspack/core";

import type {RuntimeModuleReaderOptions} from "../types";

/** Read the calling entrypoint's live runtime without initializing other features. */
export const createRuntimeModule = (readers: readonly RuntimeModuleReaderOptions[]): string => {
    return readers
        .map(
            ({export: name, property}) =>
                `export const ${name} = () => ${RuntimeGlobals.require}[${JSON.stringify(property)}];\n`
        )
        .join("");
};
