export interface CspBuilder<TCsp> {
    add(csp: TCsp): this;

    build(): string | undefined;
}
