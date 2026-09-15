import type {ContentScriptIsolation, ContentScriptProps} from "./common";
import type {ContentScriptVanillaRenderValue, ContentScriptReactRenderValue} from "./adapters";

/** All supported render values; the entrypoint's filename selects the runtime adapter. */
export type ContentScriptRenderValue<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = ContentScriptVanillaRenderValue | ContentScriptReactRenderValue<Data, Isolation>;

/** Synchronous rendering into prepared DOM. Await data and decide whether to render in prepare. */
export type ContentScriptRenderHandler<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = (props: ContentScriptProps<Data, Isolation>) => ContentScriptRenderValue<Data, Isolation>;
