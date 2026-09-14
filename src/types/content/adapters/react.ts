import type {ReactNode} from "react";

import type {ContentScriptProps} from "../common";

export type ContentScriptRenderReactComponent<Data = unknown> = (
    props: ContentScriptProps<Data>
) => Exclude<ReactNode, Promise<unknown>>;

export type ContentScriptReactRenderValue<Data = unknown> =
    | Exclude<ReactNode, Promise<unknown>>
    | ContentScriptRenderReactComponent<Data>;
