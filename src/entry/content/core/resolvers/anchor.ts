import {ContentScriptAnchor, ContentScriptAnchorGetter} from "@typing/content";

// prettier-ignore
export const contentScriptAnchorResolver =
    (anchor?: ContentScriptAnchor | ContentScriptAnchorGetter): ContentScriptAnchorGetter =>
        async (): Promise<ContentScriptAnchor> => {
            let resolved = typeof anchor === "function" ? anchor() : anchor;

            if (resolved instanceof Promise) {
                resolved = await resolved;
            }

            if (resolved === undefined || resolved === null) {
                return document.body;
            }

            return resolved;
        };
