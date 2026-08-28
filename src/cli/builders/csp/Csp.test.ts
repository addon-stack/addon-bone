import Csp from "./Csp";

import {CspSource} from "@typing/csp";

describe("Csp", () => {
    test("returns no policy until at least one view CSP is added", () => {
        expect(new Csp().build()).toBeUndefined();
    });

    test("merges view CSP sources into extension page directives", () => {
        const policy = new Csp()
            .add({
                wasm: true,
                sources: {
                    connect: [CspSource.Self, "https://api.example.com"],
                    image: [CspSource.Self, CspSource.Data],
                    style: [CspSource.Self, CspSource.UnsafeInline],
                },
            })
            .add({
                sources: {
                    image: [CspSource.Blob],
                    worker: [CspSource.Blob],
                },
            })
            .build();

        expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval';");
        expect(policy).toContain("object-src 'self';");
        expect(policy).toContain("connect-src 'self' https://api.example.com;");
        expect(policy).toContain("img-src 'self' data: blob:;");
        expect(policy).toContain("style-src 'self' 'unsafe-inline';");
        expect(policy).toContain("worker-src blob:;");
    });
});
