import type {ContentScriptWorld} from "@typing/content";

const ContentLayerPrefix = "adnbn:content:";

/** Shared build identity for content and Relay modules, independent of their UI isolation. */
export const getContentLayer = (world: ContentScriptWorld): string => {
    return `${ContentLayerPrefix}${world.toLowerCase()}`;
};

export const isContentLayer = (layer: string): boolean => layer.startsWith(ContentLayerPrefix);
