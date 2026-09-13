import type {EntrypointAssets, EntrypointAssetsMap} from "@typing/entrypoint";

/** Package fallback; extension builds provide access to their own bundler runtime. */
export const readAssets = (): EntrypointAssets | undefined => undefined;

/** Package fallback; the complete map is supplied only by a consuming background runtime. */
export const readAssetsMap = (): EntrypointAssetsMap | undefined => undefined;
