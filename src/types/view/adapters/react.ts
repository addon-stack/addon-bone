import type {ReactNode} from "react";

import type {ViewConfig} from "../common";

/** A synchronous client component with the view options as props, invoked by React. */
export type ViewRenderReactComponent<T extends ViewConfig> = (props: T) => Exclude<ReactNode, Promise<unknown>>;

export type ViewReactRenderValue<T extends ViewConfig> =
    | Exclude<ReactNode, Promise<unknown>>
    | ViewRenderReactComponent<T>;
