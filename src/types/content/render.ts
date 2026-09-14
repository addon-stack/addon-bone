import type {ContentScriptProps} from "./common";
import type {ContentScriptVanillaRenderValue, ContentScriptReactRenderValue} from "./adapters";

/** All supported render values; the entrypoint's filename selects the runtime adapter. */
export type ContentScriptRenderValue<Data = unknown> =
    | ContentScriptVanillaRenderValue
    | ContentScriptReactRenderValue<Data>;

/** Synchronous rendering into prepared DOM. Await data and decide whether to render in prepare. */
export type ContentScriptRenderHandler<Data = unknown> = (
    props: ContentScriptProps<Data>
) => ContentScriptRenderValue<Data>;
