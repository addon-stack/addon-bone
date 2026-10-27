import type {ViewConfig} from "./common";
import type {ViewReactRenderValue, ViewVanillaRenderValue} from "./adapters";

/** All supported render values; the entrypoint's filename selects the runtime adapter. */
export type ViewRenderValue<T extends ViewConfig> = ViewVanillaRenderValue | ViewReactRenderValue<T>;

/** Synchronous rendering with the view options as props. Load data separately and update the rendered UI. */
export type ViewRenderHandler<T extends ViewConfig> = (props: T) => void | ViewRenderValue<T>;
