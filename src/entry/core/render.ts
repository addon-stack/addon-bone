/** Render values that every adapter supports without a UI framework. */
export type DomRenderValue = string | number | Element;

export const isDomRenderValue = (value: unknown): value is DomRenderValue => {
    return (
        (typeof value === "string" && value.length > 0) ||
        typeof value === "number" ||
        // Compare the node type, not instanceof Element: an element may come from another realm, such as an iframe.
        (typeof value === "object" && value !== null && (value as Node).nodeType === Node.ELEMENT_NODE)
    );
};

/** Text is always inserted as text, never parsed as HTML; markup comes from elements or a UI framework. */
export const renderDomValue = (target: Element, value: DomRenderValue): void => {
    if (typeof value === "object") {
        target.appendChild(value);
    } else {
        target.textContent = String(value);
    }
};
