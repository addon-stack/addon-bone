import type {ReactNode} from "react";

import type {ContentScriptIsolation, ContentScriptProps} from "../common";

export type ContentScriptRenderReactComponent<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = (props: ContentScriptProps<Data, Isolation>) => Exclude<ReactNode, Promise<unknown>>;

export type ContentScriptReactRenderValue<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = Exclude<ReactNode, Promise<unknown>> | ContentScriptRenderReactComponent<Data, Isolation>;
