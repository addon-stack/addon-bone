import {customAlphabet} from "nanoid";

import AbstractMarker from "./AbstractMarker";

import {ContentScriptAnchor, ContentScriptMarkerValue} from "@typing/content";

export default class extends AbstractMarker {
    protected readonly attr: string;

    constructor(anchor?: ContentScriptAnchor) {
        super(anchor);

        const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 7);

        this.attr = `data-${generateId()}`;
    }

    public isMarked(element: Element): boolean {
        return element.hasAttribute(this.attr);
    }

    public mark(element: Element, value: ContentScriptMarkerValue): boolean {
        element.setAttribute(this.attr, value);

        return true;
    }

    public marked(): Element[] {
        const anchor = this.anchor;

        if (anchor instanceof Element) {
            if (this.isMarked(anchor)) {
                return [anchor];
            }

            return [];
        }

        return Array.from(document.querySelectorAll(`${anchor}[${this.attr}]`));
    }

    public unmark(element: Element): boolean {
        element.removeAttribute(this.attr);

        return true;
    }

    public value(element: Element): ContentScriptMarkerValue | undefined {
        const value = element.getAttribute(this.attr);

        return this.isValidValue(value) ? value : undefined;
    }

    protected querySelector(selector: string): Element[] {
        return super.querySelector(`${selector}:not([${this.attr}])`);
    }

    protected queryXpath(xpath: string): Element[] {
        return super.queryXpath(`(${xpath})[not(@${this.attr})]`);
    }
}
