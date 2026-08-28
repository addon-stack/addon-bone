import {CspSource} from "@typing/csp";
import type {CspConfig, CspSources} from "@typing/csp";

import AbstractCsp from "./AbstractCsp";

const SourceDirectives: Record<keyof CspSources, string> = {
    connect: "connect-src",
    image: "img-src",
    style: "style-src",
    font: "font-src",
    media: "media-src",
    worker: "worker-src",
    child: "child-src",
    frame: "frame-src",
};

export default class Csp extends AbstractCsp<CspConfig> {
    private active = false;
    private wasm = false;

    public add(csp: CspConfig): this {
        this.active = true;

        if (csp.wasm) {
            this.wasm = true;
        }

        this.addSources(csp.sources, SourceDirectives);

        return this;
    }

    public build(): string | undefined {
        if (!this.active) {
            return;
        }

        const script = ["script-src", CspSource.Self];

        if (this.wasm) {
            script.push("'wasm-unsafe-eval'");
        }

        const directives = [script, ["object-src", CspSource.Self], ...this.sourceDirectives()];

        return this.serialize(directives);
    }
}
