import type {ContentScriptTarget, ContentScriptTargetCreator} from "@typing/content";

/** Creates the renderer-owned element in the document supplied by the isolation node. */
export const createTargetResolver =
    <Data = unknown>(target?: ContentScriptTarget<Data>): ContentScriptTargetCreator<Data> =>
    props => {
        let element = typeof target === "function" ? target(props) : (target ?? "div");
        const {document, container, boundary} = props;

        if (element && typeof element === "object" && "then" in element && typeof element.then === "function") {
            throw new Error(
                "Content script target factory must return synchronously; use prepare for asynchronous work"
            );
        }

        if (typeof element === "string") {
            element = document.createElement(element);
        } else if (element && typeof element === "object" && "tagName" in element && !("nodeType" in element)) {
            const {tagName, ...options} = element;
            element = document.createElement(tagName);
            Object.assign(element, options);
        }

        const ElementConstructor = document.defaultView?.Element ?? Element;

        if (!(element instanceof ElementConstructor)) {
            throw new Error("The content script target must be a valid element");
        }

        if (element.ownerDocument !== document) {
            throw new Error("The content script target must belong to the supplied document");
        }

        if (element.parentNode || element === container || element === boundary) {
            throw new Error(
                "The content script target must be a detached element distinct from its container and boundary"
            );
        }

        return element;
    };
