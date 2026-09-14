import type {FC, ReactNode} from "react";

import type {ContentScriptProps} from "../common";

export type ContentScriptRenderReactComponent = FC<ContentScriptProps>;

export type ContentScriptReactRenderValue = ReactNode | ContentScriptRenderReactComponent;
