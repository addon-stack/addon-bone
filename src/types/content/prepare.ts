import type {Awaiter} from "@typing/helpers";
import type {ContentScriptEntrypointOptions} from "./common";

/** Per-anchor input available before a container or render target exists. */
export interface ContentScriptPrepareProps extends ContentScriptEntrypointOptions {
    anchor: Element;
}

/** False tracks the anchor without creating UI. Other results become render props.data. */
export type ContentScriptPrepareResult<Data> = Data | false;

export type ContentScriptPrepareHandler<Data = unknown> = (
    props: ContentScriptPrepareProps
) => Awaiter<ContentScriptPrepareResult<Data>>;
