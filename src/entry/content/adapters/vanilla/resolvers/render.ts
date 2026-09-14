import type {ContentScriptRenderHandler, ContentScriptRenderValue} from "@typing/content";

export const isValidRenderValue = (value: unknown): value is string | number | Element => {
    return (typeof value === "string" && value.length > 0) || typeof value === "number" || value instanceof Element;
};

// prettier-ignore
export const createRenderResolver =
    (render?: ContentScriptRenderValue | ContentScriptRenderHandler): ContentScriptRenderHandler =>
        async (props): Promise<undefined | ContentScriptRenderValue> => {
            let resolvedRender = typeof render === "function" ? render(props) : render;

            if (resolvedRender instanceof Promise) {
                resolvedRender = await resolvedRender;
            }

            if (resolvedRender !== true && !isValidRenderValue(resolvedRender)) {
                return;
            }

            return resolvedRender;
        };
