import path from "path";

import {isFile} from "@cli/utils/fs";

import {EntrypointFileExtensions} from "@typing/entrypoint";
import {LocaleFileExtensions} from "@typing/locale";
import {IconFileExtensions} from "@typing/icon";

const entrypointExtensionsPattern = [...EntrypointFileExtensions].map(ext => ext.replace(".", "\\.")).join("|");

const entrypointExtensionRegex = new RegExp(`\\.(${entrypointExtensionsPattern})$`, "i");

const assetsFileExtensions = new Set([...LocaleFileExtensions, ...IconFileExtensions]);

export const hasEntrypointPath = (filename: string): boolean => {
    return entrypointExtensionRegex.test(filename) && isFile(filename);
};

export const resolveEntrypointPath = (basepath: string): string | undefined => {
    const candidates = [basepath, path.join(basepath, "index")];

    for (const ext of EntrypointFileExtensions) {
        for (const candidate of candidates) {
            const pathname = `${candidate}.${ext}`;

            if (isFile(pathname)) {
                return pathname;
            }
        }
    }
};

export const resolveAssetsPath = (basepath: string): string | undefined => {
    for (const ext of assetsFileExtensions) {
        const pathname = `${basepath}.${ext}`;

        if (isFile(pathname)) {
            return pathname;
        }
    }
};
