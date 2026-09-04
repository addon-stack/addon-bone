import {ContentScriptNode} from "@typing/content";

export default class implements ContentScriptNode {
    private mounted: boolean = false;

    constructor(
        protected readonly node: ContentScriptNode,
        protected readonly value?: null | boolean | string | number | Element
    ) {}

    public get anchor(): Element {
        return this.node.anchor;
    }

    public get container(): Element | undefined {
        return this.node.container;
    }

    public get target(): Element | undefined {
        return this.node.target;
    }

    public mount(): boolean {
        this.node.mount();

        if (!this.target || this.mounted) {
            return false;
        }

        let result: boolean = true;

        if (this.value instanceof Element) {
            this.target.appendChild(this.value);
        } else if (typeof this.value === "string" || typeof this.value === "number") {
            this.target.textContent = String(this.value);
        } else if (this.value === null || this.value === undefined || this.value === false) {
            result = false;

            console.warn("Content script vanilla value is empty");
        } else if (this.value === true) {
            result = false;
        }

        this.mounted = true;

        return result;
    }

    public unmount(): boolean {
        this.mounted = false;

        return !!this.node.unmount();
    }
}
