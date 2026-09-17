import type {ContentScriptWorld} from "@typing/content";

// CSS classification is independent of the importing JavaScript module's layer.
// Default styles follow each entry's delivery policy; ?unisolated always targets the document.
export const DefaultStylesLayer = "adnbn:css:default";
export const DocumentStylesLayer = "adnbn:css:document";

/** JavaScript identity depends on the execution world, never on CSS delivery. */
export const getContentLayer = (world: ContentScriptWorld): string => {
    return `adnbn:content:${world.toLowerCase()}`;
};
