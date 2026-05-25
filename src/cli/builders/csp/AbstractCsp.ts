import type {CspBuilder} from "./types";

export default abstract class AbstractCsp<TPolicy> implements CspBuilder<TPolicy> {
    protected readonly sources: Map<string, Set<string>> = new Map();

    public abstract add(policy: TPolicy): this;

    public abstract build(): string | undefined;

    protected addSources<TSources extends object>(
        sources: TSources | undefined,
        directives: Partial<Record<keyof TSources & string, string>>
    ): void {
        for (const [key, values] of Object.entries(sources || {}) as Array<[keyof TSources & string, string[]]>) {
            const directive = directives[key];

            if (!directive || !values) {
                continue;
            }

            const source = this.sources.get(directive) ?? new Set();

            for (const value of values) {
                source.add(value);
            }

            this.sources.set(directive, source);
        }
    }

    protected sourceDirectives(): string[][] {
        return Array.from(this.sources.entries()).map(([directive, values]) => [directive, ...values]);
    }

    protected serialize(directives: string[][]): string {
        return directives.map(parts => `${parts.join(" ")};`).join(" ");
    }
}
