import type {Awaiter} from "@typing/helpers";

import type {ContentScriptProps} from "./common";
import type {ContentScriptVanillaRenderValue, ContentScriptReactRenderValue} from "./adapters";

/** All supported render values; the entrypoint's filename selects the runtime adapter. */
export type ContentScriptRenderValue = ContentScriptVanillaRenderValue | ContentScriptReactRenderValue;

export type ContentScriptRenderHandler = (props: ContentScriptProps) => Awaiter<undefined | ContentScriptRenderValue>;
