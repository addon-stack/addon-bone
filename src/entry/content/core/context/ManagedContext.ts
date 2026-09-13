import Context from "./Context";

import {ContentScriptNode} from "@typing/content";

export default class extends Context {
    public add(node: ContentScriptNode): this {
        this.collection.add(node);

        this.emitter.emitAdd(node);

        return this;
    }
}
