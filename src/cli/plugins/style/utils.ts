import {ChildNode} from "postcss";
import * as scss from "postcss-scss";

import {rebaseModuleRequest, rebaseUrlFunctions} from "./rebase";

export type StyleSource = {
    filename: string;
    content: string;
};

type StyleSourceParts = {
    charsets: string[];
    sassPrelude: string[];
    cssPrelude: string[];
    body: string[];
};

export const mergeStyleSources = (sharedStyle: StyleSource, appStyle: StyleSource): string => {
    const shared = splitStyleSource(sharedStyle, sharedStyle.filename);
    const app = splitStyleSource(appStyle, sharedStyle.filename);

    return [
        ...dedupePrelude([...shared.charsets, ...app.charsets]),
        ...dedupePrelude([...shared.sassPrelude, ...app.sassPrelude]),
        ...dedupePrelude([...shared.cssPrelude, ...app.cssPrelude]),
        ...shared.body,
        ...app.body,
    ]
        .map(part => part.trim())
        .filter(Boolean)
        .join("\n\n");
};

// App overrides repeat the shared @use/@forward; Sass rejects duplicate modules, so collapse exact matches while keeping differing statements that signal real conflicts.
const dedupePrelude = (parts: string[]): string[] => {
    const seen = new Set<string>();

    return parts.filter(part => {
        const key = part.trim();

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
};

const splitStyleSource = (source: StyleSource, target: string): StyleSourceParts => {
    const root = scss.parse(source.content, {from: source.filename});
    // Only a source compiled under another filename needs its resources rebased.
    const relocated = source.filename !== target;

    root.walkAtRules(node => {
        if (isModuleRuleNode(node)) {
            // Shared requests pass through the same normalization, so equivalent prepared
            // imports from both sources match when the prelude is deduplicated.
            node.params = rebaseModuleRequest(node.params, source.filename, target);
        }

        if (relocated) {
            // Module configuration such as `with ($font: url(...))` carries app resources as well.
            node.params = rebaseUrlFunctions(node.params, source.filename, target);
        }
    });

    if (relocated) {
        root.walkDecls(node => {
            node.value = rebaseUrlFunctions(node.value, source.filename, target);
        });
    }

    const parts: StyleSourceParts = {
        charsets: [],
        sassPrelude: [],
        cssPrelude: [],
        body: [],
    };

    let bodyStarted = false;
    let preludeType: "sass" | "css" = "sass";

    root.nodes?.forEach(node => {
        if (!bodyStarted && isCharsetNode(node)) {
            parts.charsets.push(stringifyNode(node));

            return;
        }

        if (!bodyStarted && node.type === "comment") {
            parts[preludeType === "sass" ? "sassPrelude" : "cssPrelude"].push(stringifyNode(node));

            return;
        }

        if (!bodyStarted && isSassPreludeNode(node)) {
            parts.sassPrelude.push(stringifyNode(node));

            return;
        }

        if (!bodyStarted && isCssPreludeNode(node)) {
            preludeType = "css";
            parts.cssPrelude.push(stringifyNode(node));

            return;
        }

        bodyStarted = true;
        parts.body.push(stringifyNode(node));
    });

    return parts;
};

const stringifyNode = (node: ChildNode): string => {
    const content = node.toString(scss.stringify);

    if ((node.type === "atrule" && !node.nodes?.length) || node.type === "decl") {
        return `${content};`;
    }

    return content;
};

const isCharsetNode = (node: ChildNode): boolean => node.type === "atrule" && node.name === "charset";

const isModuleRuleNode = (node: ChildNode): boolean => node.type === "atrule" && ["forward", "use"].includes(node.name);

const isSassPreludeNode = (node: ChildNode): boolean => {
    if (node.type === "decl") {
        return node.prop.startsWith("$");
    }

    return isModuleRuleNode(node);
};

const isCssPreludeNode = (node: ChildNode): boolean => {
    if (node.type !== "atrule" || node.nodes?.length) {
        return false;
    }

    return ["import", "namespace", "layer"].includes(node.name);
};
