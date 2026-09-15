import type {EntrypointAssets, EntrypointAssetsMap} from "@typing/entrypoint";
import type {ContentScriptStylesRuntime} from "@typing/content";

/** Package fallback; extension builds provide access to their own bundler runtime. */
export const readAssets = (): EntrypointAssets | undefined => undefined;

/** Package fallback; the complete map is supplied only by a consuming background runtime. */
export const readAssetsMap = (): EntrypointAssetsMap | undefined => undefined;

/** Package fallback; isolated content builds supply their own styles runtime. */
export const readContentStyles = (): ContentScriptStylesRuntime | undefined => undefined;
