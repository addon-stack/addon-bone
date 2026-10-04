import {statSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import valueParser from "postcss-value-parser";

import {toPosix} from "@cli/utils/path";

import type {StyleDependencyHandler} from "./types";

const RelativeRequestPattern = /^\.{1,2}\//;
const ExternalRequestPattern = /^(?:[a-z][a-z\d+.-]*:|[/#?~@$])/i;
const SassExtensions = [".scss", ".sass", ".css"];

/** Resolves local Sass module requests without selecting a partial, index or import-only file. */
export const prepareModuleRequests = (
    params: string,
    filename: string,
    legacyImport = false,
    onDependency?: StyleDependencyHandler
): string => {
    const parsed = valueParser(params);
    let start = true;

    for (const [index, node] of parsed.nodes.entries()) {
        if (node.type === "space" || node.type === "comment") {
            continue;
        }

        if (legacyImport && node.type === "div" && node.value === ",") {
            start = true;

            continue;
        }

        if (start && node.type === "string" && !node.unclosed && isLocalRequest(decodeCssString(node.value))) {
            const request = decodeCssString(node.value);
            const tail = parsed.nodes.slice(index + 1);
            const nextComma = tail.findIndex(token => token.type === "div" && token.value === ",");
            const suffix = nextComma === -1 ? tail : tail.slice(0, nextComma);

            const cssImport =
                legacyImport &&
                (/\.css(?:[?#]|$)/i.test(request) ||
                    suffix.some(token => token.type !== "space" && token.type !== "comment"));

            if (cssImport) {
                node.value = escapeQuotedValue(absoluteResourcePath(request, filename), node.quote);
            } else {
                // Sass treats bare Windows drive paths as URL schemes. File URLs also encode
                // spaces while preserving existing percent escapes in module requests.
                // Sass permits literal percent signs; encode those before Node decodes the URL.
                const resolved = new URL(request.replace(/%(?![\da-f]{2})/gi, "%25"), pathToFileURL(filename));
                // Track missing relative imports too, so creating the module can recover a failed build.
                const local = hasLocalModule(fileURLToPath(resolved), legacyImport, onDependency);

                if (RelativeRequestPattern.test(request) || local) {
                    node.value = escapeQuotedValue(resolved.href, node.quote);
                }
            }
        }

        if (!legacyImport) {
            break;
        }

        start = false;
    }

    return parsed.toString();
};

/** Makes literal resource values independent of the Sass file that eventually emits them. */
export const prepareUrlFunctions = (value: string, filename: string): string => {
    const parsed = valueParser(value);
    let prepared = false;

    parsed.walk(node => {
        if (node.type !== "function" || node.value.toLowerCase() !== "url") {
            return;
        }

        const tokens = node.nodes.filter(token => token.type !== "space" && token.type !== "comment");
        const url = tokens[0];

        if (node.unclosed || tokens.length !== 1 || !isLiteralUrl(url)) {
            return false;
        }

        // Absolute filesystem requests survive Sass configuration/variable substitution and
        // are left alone by resolve-url-loader. Quoting protects spaces in source directories.
        const quote = url.type === "string" ? url.quote : '"';
        const quoted: valueParser.StringNode = {
            ...url,
            type: "string",
            quote,
            value: escapeQuotedValue(absoluteResourcePath(decodeCssString(url.value), filename), quote),
        };

        node.nodes = node.nodes.map(token => (token === url ? quoted : token));
        prepared = true;

        return false;
    });

    return prepared ? parsed.toString() : value;
};

const isLiteralUrl = (token: valueParser.Node): token is valueParser.StringNode | valueParser.WordNode => {
    if (token.type === "string") {
        return !token.unclosed && isLocalRequest(decodeCssString(token.value));
    }

    if (token.type === "word") {
        return isLocalRequest(decodeCssString(token.value)) && !/[$()]/.test(token.value);
    }

    return false;
};

const isLocalRequest = (value: string): boolean => {
    return Boolean(value) && !ExternalRequestPattern.test(value) && !value.includes("#{");
};

const absoluteResourcePath = (request: string, filename: string): string => {
    const suffixIndex = request.search(/[?#]/);
    const pathname = suffixIndex === -1 ? request : request.slice(0, suffixIndex);
    const suffix = suffixIndex === -1 ? "" : request.slice(suffixIndex);

    return path.posix.join(toPosix(path.dirname(filename)), pathname) + suffix;
};

const escapeQuotedValue = (value: string, quote: string): string => {
    return value.replace(/[\\\n\r\f'"]/g, token => {
        if (/[\n\r\f]/.test(token)) {
            return `\\${token.codePointAt(0)!.toString(16)} `;
        }

        return token === "\\" || token === quote ? `\\${token}` : token;
    });
};

// Value-parser retains CSS escapes. Decode string contents before treating them as a
// filesystem path; otherwise `space\\ name` would become a URL containing a backslash.
const decodeCssString = (value: string): string => {
    return value.replace(
        /\\(?:([\da-f]{1,6})(?:\r\n|[ \t\n\r\f])?|(\r\n|[\n\r\f])|([\s\S]))/gi,
        (_match, hex: string | undefined, newline: string | undefined, character: string | undefined) => {
            if (hex) {
                const codePoint = Number.parseInt(hex, 16);

                return codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)
                    ? "\uFFFD"
                    : String.fromCodePoint(codePoint);
            }

            return newline ? "" : character!;
        }
    );
};

// Detect local candidates without selecting a stylesheet. Sass still chooses among
// partials, indexes and import-only files, and reports ambiguity using its normal rules.
// Visit every candidate so creating an absent alternative invalidates the watch compilation.
const hasLocalModule = (filename: string, legacyImport: boolean, onDependency?: StyleDependencyHandler): boolean => {
    const candidates = SassExtensions.includes(path.extname(filename))
        ? [filename]
        : SassExtensions.flatMap(extension => [filename + extension, path.join(filename, "index" + extension)]);

    if (legacyImport) {
        candidates.push(
            ...candidates.map(candidate => {
                const extension = path.extname(candidate);

                return candidate.slice(0, -extension.length) + ".import" + extension;
            })
        );
    }

    const filenames = candidates.flatMap(candidate => [
        candidate,
        path.join(path.dirname(candidate), "_" + path.basename(candidate)),
    ]);

    let found = false;

    for (const candidate of new Set(filenames)) {
        const exists = isFile(candidate);
        onDependency?.(candidate, exists);
        found ||= exists;
    }

    return found;
};

const isFile = (filename: string): boolean => {
    try {
        return statSync(filename).isFile();
    } catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) {
            throw error;
        }

        return false;
    }
};
