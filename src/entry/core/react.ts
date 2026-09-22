import {isValidElement, type ReactNode} from "react";

const ReactPortalType = Symbol.for("react.portal");

/**
 * React-only render values: elements (including fragments), portals, bigints and iterables of nodes.
 * Text, numbers and DOM elements are framework-independent and belong to `isDomRenderValue()`.
 */
export const isReactRenderValue = (value: unknown): value is ReactNode => {
    if (isValidElement(value) || typeof value === "bigint") {
        return true;
    }

    if (typeof value !== "object" || value === null) {
        return false;
    }

    const node = value as {$$typeof?: unknown; [Symbol.iterator]?: unknown};

    // A portal is a plain object that isValidElement() does not recognize; an iterable needs a callable iterator.
    return node.$$typeof === ReactPortalType || typeof node[Symbol.iterator] === "function";
};
