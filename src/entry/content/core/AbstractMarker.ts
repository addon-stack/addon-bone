import {ContentScriptAnchor, ContentScriptMarkerContract, ContentScriptMarkerValue} from "@typing/content";

export default abstract class implements ContentScriptMarkerContract {
    public abstract mark(element: Element, value: ContentScriptMarkerValue): boolean;

    public abstract unmark(element: Element): boolean;

    public abstract isMarked(element: Element): boolean;

    public abstract value(element: Element): ContentScriptMarkerValue | undefined;

    protected constructor(protected anchor: ContentScriptAnchor) {}

    public for(anchor: ContentScriptAnchor): ContentScriptMarkerContract {
        this.anchor = anchor;

        return this;
    }

    public unmarked(): Element[] {
        return this.query(false);
    }

    public marked(): Element[] {
        return this.query(true);
    }

    public mount(element: Element): boolean {
        return this.mark(element, ContentScriptMarkerValue.Mounted);
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

    protected query(marked: boolean): Element[] {
        const anchor = this.anchor;

        if (anchor instanceof Element) {
            const isMarked = this.isMarked(anchor);

            if ((isMarked && marked) || (!isMarked && !marked)) {
                return [anchor];
            }
        } else if (typeof anchor === "string") {
            return this.queryAnchor(anchor, marked);
        }

        return [];
    }

    protected queryAnchor(anchor: string, marked: boolean = false): Element[] {
        try {
            if (anchor.startsWith("/")) {
                return this.queryXpath(anchor, marked);
            }

            return this.querySelector(anchor, marked);
        } catch (e) {
            console.error(`Invalid anchor format. Expected a valid string (CSS selector/XPath)\n\n`, e);

            return [];
        }
    }

    protected querySelector(selector: string, _marked: boolean = false): Element[] {
        return Array.from(document.querySelectorAll(selector));
    }

    protected queryXpath(xpath: string, _marked: boolean = false): Element[] {
        const elements: Element[] = [];

        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i) as Element);
        }

        return elements;
    }

    protected isValidValue(value: any): value is ContentScriptMarkerValue {
        return [ContentScriptMarkerValue.Unmounted, ContentScriptMarkerValue.Mounted].includes(value);
    }
}
