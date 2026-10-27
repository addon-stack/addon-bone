import {type AtRule, type ChildNode} from "postcss";
import * as scss from "postcss-scss";
import valueParser from "postcss-value-parser";

import {prepareModuleRequests, prepareUrlFunctions} from "./style-paths";
import type {StyleDependencyHandler, StyleSource} from "./types";

type StyleSourceParts = {
    charsets: ChildNode[];
    sassPrelude: ChildNode[];
    cssPrelude: ChildNode[];
    body: ChildNode[];
};

/**
 * Prepares ordered CSS/SCSS sources for compilation as one resource. Source filenames must be absolute;
 * the caller owns file discovery, reading and watch dependencies. Local Sass requests and literal
 * resource URLs retain their declaring file's location, including values passed through `with`.
 * The target remains the resource compiled by Sass and css-loader, preserving its CSS module identity.
 */
export const prepareStyleSources = (
    sources: readonly StyleSource[],
    targetFilename: string,
    onDependency?: StyleDependencyHandler
): string => {
    const parts = sources.map(source => splitStyleSource(source, onDependency));
    const seen = new Set<string>();

    for (const source of parts) {
        const counts = new Map<string, number>();

        for (const node of source.sassPrelude) {
            const key = reusableModuleKey(node);

            if (key) {
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }

        source.sassPrelude = source.sassPrelude.filter(node => {
            const key = reusableModuleKey(node);

            // Repeated directives within one source must remain visible to Sass, even if
            // a previous source used the same module. Configuration and variables are stateful.
            return !key || counts.get(key) !== 1 || !seen.has(key);
        });

        counts.forEach((_count, key) => seen.add(key));
    }

    const result = scss.parse("", {from: targetFilename});

    for (const bucket of ["charsets", "sassPrelude", "cssPrelude", "body"] as const) {
        for (const source of parts) {
            for (const node of source[bucket]) {
                node.raws.before = "\n";
                result.append(node);
            }
        }
    }

    result.raws.semicolon = true;

    return result.toString(scss.stringify).trim();
};

const splitStyleSource = (source: StyleSource, onDependency?: StyleDependencyHandler): StyleSourceParts => {
    const root = scss.parse(source.content, {from: source.filename});

    root.walkAtRules(node => {
        node.params = prepareUrlFunctions(node.params, source.filename);

        if (["use", "forward", "import"].includes(node.name)) {
            node.params = prepareModuleRequests(node.params, source.filename, node.name === "import", onDependency);
        }
    });

    root.walkDecls(node => {
        node.value = prepareUrlFunctions(node.value, source.filename);
    });

    const parts: StyleSourceParts = {charsets: [], sassPrelude: [], cssPrelude: [], body: []};
    let modulesClosed = false;
    let bodyStarted = false;

    for (const node of root.nodes) {
        const module = isModuleRule(node);

        if (module && modulesClosed) {
            throw node.error(`@${node.name} must precede other rules in its source stylesheet`);
        }

        const charset = node.type === "atrule" && node.name === "charset";
        const variable = node.type === "decl" && node.prop.startsWith("$");

        if (!modulesClosed && (module || variable || charset || node.type === "comment")) {
            parts[charset ? "charsets" : "sassPrelude"].push(node);
        } else if (!bodyStarted && (isCssPreludeRule(node) || node.type === "comment")) {
            modulesClosed = true;
            parts.cssPrelude.push(node);
        } else {
            modulesClosed = true;
            bodyStarted = true;
            parts.body.push(node);
        }
    }

    return parts;
};

const reusableModuleKey = (node: ChildNode): string | undefined => {
    if (!isModuleRule(node) || node.nodes) {
        return;
    }

    const configured = valueParser(node.params).nodes.some(
        token => (token.type === "word" || token.type === "function") && token.value === "with"
    );

    return configured ? undefined : node.toString(scss.stringify).trim();
};

const isModuleRule = (node: ChildNode): node is AtRule => {
    return node.type === "atrule" && ["use", "forward"].includes(node.name);
};

const isCssPreludeRule = (node: ChildNode): boolean => {
    return node.type === "atrule" && !node.nodes && ["import", "namespace", "layer"].includes(node.name);
};
