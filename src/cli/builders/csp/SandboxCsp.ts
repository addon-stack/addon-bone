import {SandboxAllow, SandboxCspConfig, SandboxSource} from "@typing/sandbox";

import AbstractCsp from "./AbstractCsp";

const SourceDirectives: Record<keyof NonNullable<SandboxCspConfig["sources"]>, string> = {
    connect: "connect-src",
    image: "img-src",
    style: "style-src",
    font: "font-src",
    media: "media-src",
    worker: "worker-src",
    child: "child-src",
};

export default class SandboxCsp extends AbstractCsp<SandboxCspConfig> {
    private active = false;
    private eval = false;
    private inline = false;
    private readonly allow = new Set<SandboxAllow | `${SandboxAllow}`>();

    public add(csp: SandboxCspConfig): this {
        this.active = true;

        csp = {
            eval: true,
            inline: false,
            allow: [],
            ...csp,
        };

        if (csp.eval) {
            this.eval = true;
        }

        if (csp.inline) {
            this.inline = true;
        }

        for (const value of csp.allow || []) {
            this.allow.add(value);
        }

        this.addSources(csp.sources, SourceDirectives);

        return this;
    }

    public build(): string | undefined {
        if (!this.active) {
            return;
        }

        const sandbox = ["sandbox", "allow-scripts", ...Array.from(this.allow).map(value => `allow-${value}`)];
        const script = ["script-src", SandboxSource.Self];

        if (this.eval) {
            script.push("'unsafe-eval'" as SandboxSource);
        }

        if (this.inline) {
            script.push(SandboxSource.UnsafeInline);
        }

        const directives = [sandbox, script, ...this.sourceDirectives()];

        return this.serialize(directives);
    }

    protected sourceDirectives(): string[][] {
        const sources = new Map(this.sources);
        const child = sources.get("child-src") || new Set();

        sources.set("child-src", new Set([SandboxSource.Self, ...child]));

        return Array.from(sources.entries()).map(([directive, values]) => [directive, ...values]);
    }
}
