import path from "path";
import valueParser from "postcss-value-parser";

import {toPosix} from "@cli/utils/path";

const RelativeRequestPattern = /^\.{1,2}\//;
// Schemes, root-relative paths, fragments, queries and ~-prefixed requests are not rebased.
const ExternalUrlPattern = /^(?:[a-z][a-z\d+.-]*:|[/#?~])/i;

/**
 * Rebases the explicit `./` or `../` module request of `@use` or `@forward` parameters written in the
 * stylesheet `from` so it resolves from the stylesheet `to`. Namespaces, `show`, `hide` and `with`
 * configuration stay as written; package, alias, built-in and interpolated requests keep their normal
 * resolution. When both stylesheets are the same file, the request is only normalized.
 */
export const rebaseModuleRequest = (params: string, from: string, to: string): string => {
    const parsed = valueParser(params);
    const request = parsed.nodes.find(node => node.type !== "space" && node.type !== "comment");

    if (
        request?.type !== "string" ||
        request.unclosed ||
        !RelativeRequestPattern.test(request.value) ||
        request.value.includes("#{")
    ) {
        return params;
    }

    request.value = rebaseStylePath(request.value, from, to);

    return parsed.toString();
};

/**
 * Rebases literal relative `url(...)` values written in the stylesheet `from` so they resolve from the
 * stylesheet `to`, including values nested in lists, functions and module configuration. Absolute URLs,
 * schemes, root-relative paths, fragments, queries, ~-prefixed requests and Sass expressions stay as written.
 * Rebased URLs are quoted and keep their query and fragment.
 */
export const rebaseUrlFunctions = (value: string, from: string, to: string): string => {
    const parsed = valueParser(value);
    let rebased = false;

    parsed.walk(node => {
        if (node.type !== "function" || node.value.toLowerCase() !== "url") {
            return;
        }

        const tokens = node.nodes.filter(token => token.type !== "space" && token.type !== "comment");
        const url = tokens[0];

        if (node.unclosed || tokens.length !== 1 || !isLiteralUrl(url)) {
            return false;
        }

        // Quote rebased URLs so spaces in the app directory remain part of the path.
        const quoted: valueParser.StringNode = {
            ...url,
            type: "string",
            quote: url.type === "string" ? url.quote : '"',
            value: rebaseStylePath(url.value, from, to),
        };

        node.nodes = node.nodes.map(token => (token === url ? quoted : token));
        rebased = true;

        return false;
    });

    return rebased ? parsed.toString() : value;
};

const isLiteralUrl = (token: valueParser.Node): token is valueParser.StringNode | valueParser.WordNode => {
    if (token.type === "string") {
        return !token.unclosed && isLiteralPath(token.value);
    }

    if (token.type === "word") {
        return isLiteralPath(token.value) && !/[$()]/.test(token.value);
    }

    return false;
};

const isLiteralPath = (value: string): boolean => {
    return Boolean(value) && !ExternalUrlPattern.test(value) && !value.includes("#{");
};

const rebaseStylePath = (request: string, from: string, to: string): string => {
    const suffixIndex = request.search(/[?#]/);
    const pathname = suffixIndex === -1 ? request : request.slice(0, suffixIndex);
    const suffix = suffixIndex === -1 ? "" : request.slice(suffixIndex);
    const directory = toPosix(path.relative(path.dirname(to), path.dirname(from)));
    // Stylesheet requests are URLs, including on Windows. Keep query/fragment data out of path normalization.
    const relative = path.posix.join(directory, pathname);

    return `${relative.startsWith("../") ? relative : `./${relative}`}${suffix}`;
};
