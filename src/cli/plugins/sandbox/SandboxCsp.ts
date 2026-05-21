import {SandboxAllow, SandboxContentSecurityPolicy, SandboxSource} from "@typing/sandbox";

const SourceDirectives: Record<keyof NonNullable<SandboxContentSecurityPolicy["sources"]>, string> = {
    connect: "connect-src",
    image: "img-src",
    style: "style-src",
    font: "font-src",
    media: "media-src",
    worker: "worker-src",
    child: "child-src",
};

export default class SandboxCsp {
    private eval = false;
    private inline = false;
    private readonly allow = new Set<SandboxAllow | `${SandboxAllow}`>();
    private readonly sources: Map<string, Set<SandboxSource | `${SandboxSource}`>> = new Map();

    public add(csp?: SandboxContentSecurityPolicy): this {
        csp = {
            eval: true,
            inline: false,
            allow: [],
            sources: {
                child: [SandboxSource.Self],
            },
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

        for (const [key, values] of Object.entries(csp.sources || {})) {
            const directive = SourceDirectives[key as keyof typeof SourceDirectives];

            if (!directive || !values) {
                continue;
            }

            const source = this.sources.get(directive) ?? new Set();

            for (const value of values) {
                source.add(value);
            }

            this.sources.set(directive, source);
        }

        return this;
    }

    public build(): string {
        const sandbox = ["sandbox", "allow-scripts", ...Array.from(this.allow).map(value => `allow-${value}`)];
        const script = ["script-src", SandboxSource.Self];

        if (this.eval) {
            script.push("'unsafe-eval'" as SandboxSource);
        }

        if (this.inline) {
            script.push(SandboxSource.UnsafeInline);
        }

        const directives = [sandbox, script];

        for (const [directive, values] of this.sources) {
            directives.push([directive, ...values]);
        }

        return directives.map(parts => `${parts.join(" ")};`).join(" ");
    }
}
