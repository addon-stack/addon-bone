import type {Awaiter} from "@typing/helpers";

import type {ViewConfig} from "./common";
import type {ViewReactRenderValue, ViewVanillaRenderValue} from "./adapters";

/** All supported render values; the entrypoint's filename selects the runtime adapter. */
export type ViewRenderValue<T extends ViewConfig> = ViewVanillaRenderValue | ViewReactRenderValue<T>;

/** A view document renders once, so its handler may await data before returning the value. */
export type ViewRenderHandler<T extends ViewConfig> = (props: T) => Awaiter<void | ViewRenderValue<T>>;
