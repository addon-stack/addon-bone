import type {FC, ReactNode} from "react";

import type {ViewConfig} from "../common";

export type ViewRenderReactComponent<T extends ViewConfig> = FC<T>;

export type ViewReactRenderValue<T extends ViewConfig> =
    | Exclude<ReactNode, Promise<unknown>>
    | ViewRenderReactComponent<T>;
