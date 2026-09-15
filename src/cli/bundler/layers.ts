import type {ContentScriptWorld} from "@typing/content";

const ContentLayerPrefix = "adnbn:content:";

// This is a bundler layer, not a CSS @layer. A distinct css-loader identity is
// also required: CssExtract deduplicates dependencies by their loader request.
export const IsolatedStylesLayer = "adnbn:css:isolation";

/** Shared build identity for content and Relay modules, independent of their UI isolation. */
export const getContentLayer = (world: ContentScriptWorld): string => {
    return `${ContentLayerPrefix}${world.toLowerCase()}`;
};

export const isContentLayer = (layer: string): boolean => layer.startsWith(ContentLayerPrefix);
