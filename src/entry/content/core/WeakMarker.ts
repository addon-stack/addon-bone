import AbstractMarker from "./AbstractMarker";

import {ContentScriptAnchor, ContentScriptMarkerValue} from "@typing/content";

export default class extends AbstractMarker {
    private readonly map: WeakMap<Element, ContentScriptMarkerValue> = new WeakMap;

    constructor(anchor?: ContentScriptAnchor) {
        super(anchor);
    }

    public mark(element: Element, value: ContentScriptMarkerValue): boolean {
        this.map.set(element, value);

        return true;
    }

    public unmark(element: Element): boolean {
        if (this.map.has(element)) {
            this.map.delete(element);

            return true;
        }

        return false;
    }

    public value(element: Element): ContentScriptMarkerValue | undefined {
        return this.map.get(element);
    }

    public isMarked(element: Element): boolean {
        return this.map.has(element);
    }

    protected queryAnchor(anchor: string, marked: boolean = false): Element[] {
        const elements = super.queryAnchor(anchor, marked);

        return elements.filter(element => this.isMarked(element) === marked);
    }
}