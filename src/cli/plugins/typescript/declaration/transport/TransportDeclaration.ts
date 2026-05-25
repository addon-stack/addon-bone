import _ from "lodash";

import FileBuilder from "../../FileBuilder";

import {ReadonlyConfig} from "@typing/config";

export enum TransportDeclarationLayer {
    Service = "service",
    Offscreen = "offscreen",
    Relay = "relay",
    Sandbox = "sandbox",
}

export default class<T extends Record<string, string> = Record<string, string>> extends FileBuilder {
    protected _dictionary?: T;

    constructor(
        config: ReadonlyConfig,
        protected readonly layer: TransportDeclarationLayer
    ) {
        super(config);
    }

    protected filename(): string {
        return this.layer + ".d.ts";
    }

    protected file(): URL {
        return new URL("./transport.d.ts", this.url());
    }

    protected url(): string {
        return import.meta.url;
    }

    protected template(): string {
        const dictionary = this._dictionary;

        if (!dictionary) {
            throw new Error(`Transport ${this.layer} dictionary is not set`);
        }

        const type = Object.entries(dictionary)
            .map(([key, value]) => {
                return `'${key}': ${value};`;
            })
            .join("\n\t\t");

        return this.readFile()
            .replaceAll(":layer", this.layer)
            .replaceAll("Layer", _.upperFirst(this.layer))
            .replaceAll("__TRANSPORT_DICTIONARY__", type);
    }

    public dictionary(dictionary: T): this {
        this._dictionary = dictionary;

        return this;
    }
}
