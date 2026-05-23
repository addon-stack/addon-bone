export enum CspSource {
    Self = "'self'",
    None = "'none'",
    Data = "data:",
    Blob = "blob:",
    UnsafeInline = "'unsafe-inline'",
}

/**
 * Source expression for a CSP directive.
 *
 * Use `CspSource` or its string values for framework-known keywords and schemes
 * such as `'self'`, `'none'`, `data:`, or `blob:`. The open string branch is for
 * concrete CSP source expressions that cannot be enumerated ahead of time, such
 * as `https://api.example.com`, `wss://socket.example.com`, `https:`, `nonce-...`,
 * or `sha256-...`. It does not mean an empty string is useful or valid.
 */
export type CspSourceValue = CspSource | `${CspSource}` | (string & Record<never, never>);

export interface CspSources {
    connect?: CspSourceValue[];
    image?: CspSourceValue[];
    style?: CspSourceValue[];
    font?: CspSourceValue[];
    media?: CspSourceValue[];
    worker?: CspSourceValue[];
    child?: CspSourceValue[];
    frame?: CspSourceValue[];
}

export interface CspConfig {
    wasm?: boolean;
    sources?: CspSources;
}

export interface CspOptions {
    csp?: CspConfig;
}
