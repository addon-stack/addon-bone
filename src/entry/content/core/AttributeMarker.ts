import {customAlphabet} from "nanoid";

import AbstractMarker from "./AbstractMarker";

import {ContentScriptAnchor, ContentScriptMarkerValue} from "@typing/content";

export default class extends AbstractMarker {
    protected readonly attr: string;

    constructor(anchor?: ContentScriptAnchor, attr?: string) {
        super(anchor);

        this.attr = attr ?? `data-${customAlphabet("abcdefghijklmnopqrstuvwxyz", 7)()}`;
    }

    public isMarked(element: Element): boolean {
        return element.hasAttribute(this.attr);
    }

    public mark(element: Element, value: ContentScriptMarkerValue): boolean {
        element.setAttribute(this.attr, value);

        return true;
    }

    public unmark(element: Element): boolean {
        element.removeAttribute(this.attr);

        return true;
    }

    public value(element: Element): ContentScriptMarkerValue | undefined {
        const value = element.getAttribute(this.attr);

        return this.isValidValue(value) ? value : undefined;
    }

    protected querySelector(selector: string, marked: boolean = false): Element[] {
        const filter = marked ? `[${this.attr}]` : `:not([${this.attr}])`;

        return super.querySelector(`:is(${selector})${filter}`, marked);
    }

    protected queryXpath(xpath: string, marked: boolean = false): Element[] {
        const filter = marked ? `[@${this.attr}]` : `[not(@${this.attr})]`;

        return super.queryXpath(`(${xpath.trim()})${filter}`, marked);
    }
}
