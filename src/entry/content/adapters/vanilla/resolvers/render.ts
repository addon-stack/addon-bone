import type {ContentScriptRenderHandler, ContentScriptRenderValue} from "@typing/content";

export const isValidRenderValue = (value: unknown): value is string | number | Element => {
    return (typeof value === "string" && value.length > 0) || typeof value === "number" || value instanceof Element;
};

// prettier-ignore
export const createRenderResolver =
    <Data = unknown>(render?: ContentScriptRenderValue<Data> | ContentScriptRenderHandler<Data>): ContentScriptRenderHandler<Data> =>
        props => {
            const resolvedRender = typeof render === "function" ? render(props) : render;

            if (!isValidRenderValue(resolvedRender)) {
                return;
            }

            return resolvedRender;
        };
