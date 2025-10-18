import {ContentScriptAnchor, ContentScriptMarkerContract, ContentScriptMarkerValue} from "@typing/content";

export default abstract class implements ContentScriptMarkerContract {
    public abstract marked(): Element[];

    public abstract mark(element: Element, value: ContentScriptMarkerValue): boolean;

    public abstract unmark(element: Element): boolean;

    public abstract isMarked(element: Element): boolean;

    public abstract value(element: Element): ContentScriptMarkerValue | undefined;

    protected constructor(protected anchor: ContentScriptAnchor) {}

    public for(anchor: ContentScriptAnchor): ContentScriptMarkerContract {
        this.anchor = anchor;

        return this;
    }

    public pending(): Element[] {
        const elements: Element[] = [];

        let resolved = this.anchor;

        if (resolved instanceof Element) {
            if (!this.isMarked(resolved)) {
                elements.push(resolved);
            }
        } else if (typeof resolved === "string") {
            if (resolved.startsWith("/")) {
                elements.push(...this.queryXpath(resolved));
            } else {
                elements.push(...this.querySelector(resolved));
            }
        }

        return elements;
    }

    public mount(element: Element): boolean {
        return this.mark(element, ContentScriptMarkerValue.Mounded);
    }

    public unmount(element: Element): boolean {
        return this.mark(element, ContentScriptMarkerValue.Unmounted);
    }

    public reset(): ContentScriptMarkerContract {
        for (const element of this.marked()) {
            this.unmark(element);
        }

        return this;
    }

    protected querySelector(selector: string): Element[] {
        return Array.from(document.querySelectorAll(selector));
    }

    protected queryXpath(xpath: string): Element[] {
        const elements: Element[] = [];

        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i) as Element);
        }

        return elements;
    }

    protected isValidValue(value: any): value is ContentScriptMarkerValue {
        return [ContentScriptMarkerValue.Unmounted, ContentScriptMarkerValue.Mounded].includes(value);
    }
}
