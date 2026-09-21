export const isValidRenderValue = (value: unknown): value is string | number | Element => {
    return (typeof value === "string" && value.length > 0) || typeof value === "number" || value instanceof Element;
};
