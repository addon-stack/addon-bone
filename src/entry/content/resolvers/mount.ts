import {ContentScriptAppend, ContentScriptMountFunction} from "@typing/content";

// prettier-ignore
export const createAppendMountHandler =
    (append?: ContentScriptAppend): ContentScriptMountFunction =>
        (anchor: Element, container: Element): void => {
            switch (append) {
                case ContentScriptAppend.Last:
                    anchor.append(container);
                    break;
                default:
                case undefined:
                case ContentScriptAppend.First:
                    anchor.prepend(container);
                    break;
                case ContentScriptAppend.Replace:
                    anchor.replaceWith(container);
                    break;
                case ContentScriptAppend.After:
                    anchor.parentElement?.insertBefore(container, anchor.nextElementSibling);
                    break;
                case ContentScriptAppend.Before:
                    anchor.parentElement?.insertBefore(container, anchor);
                    break;
            }
        };
