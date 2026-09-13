import {ContentScriptNode} from "@typing/content";

export default class implements ContentScriptNode {
    private readonly _container?: Element;

    constructor(
        public readonly anchor: Element,
        public container?: Element
    ) {
        if (this.container) {
            this._container = this.container.cloneNode(false) as Element;
        }
    }

    public get target(): Element | undefined {
        return this.container;
    }

    public mount(): boolean {
        if (!this.container && this._container) {
            this.container = this._container.cloneNode(false) as Element;

            return true;
        }

        return false;
    }

    public unmount(): boolean {
        if (this.container) {
            this.container.remove();
            this.container = undefined;

            return true;
        }

        return false;
    }
}
