import {ChildNode} from "postcss";
import * as scss from "postcss-scss";

type StyleSourceParts = {
    charsets: string[];
    sassPrelude: string[];
    cssPrelude: string[];
    body: string[];
};

export const mergeStyleSources = (sharedStyle: string, appStyle: string): string => {
    const shared = splitStyleSource(sharedStyle);
    const app = splitStyleSource(appStyle);

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

const splitStyleSource = (source: string): StyleSourceParts => {
    const root = scss.parse(source);

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

const isSassPreludeNode = (node: ChildNode): boolean => {
    if (node.type === "decl") {
        return node.prop.startsWith("$");
    }

    if (node.type !== "atrule") {
        return false;
    }

    return ["forward", "use"].includes(node.name);
};

const isCssPreludeNode = (node: ChildNode): boolean => {
    if (node.type !== "atrule" || node.nodes?.length) {
        return false;
    }

    return ["import", "namespace", "layer"].includes(node.name);
};
