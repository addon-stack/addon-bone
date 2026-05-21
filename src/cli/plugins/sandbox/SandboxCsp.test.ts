import SandboxCsp from "./SandboxCsp";

import {SandboxAllow, SandboxSource} from "@typing/sandbox";

describe("SandboxCsp", () => {
    test("builds the default sandbox policy", () => {
        expect(new SandboxCsp().add().build()).toBe(
            "sandbox allow-scripts; script-src 'self' 'unsafe-eval'; child-src 'self';"
        );
    });

    test("merges allow tokens and sources", () => {
        const policy = new SandboxCsp()
            .add({
                eval: false,
                inline: true,
                allow: [SandboxAllow.Forms, "modals"],
                sources: {
                    image: [SandboxSource.Self, SandboxSource.Data],
                    style: [SandboxSource.Self, SandboxSource.UnsafeInline],
                },
            })
            .add({
                eval: true,
                allow: [SandboxAllow.Popups],
                sources: {
                    image: [SandboxSource.Blob],
                },
            })
            .build();

        expect(policy).toContain("sandbox allow-scripts allow-forms allow-modals allow-popups;");
        expect(policy).toContain("script-src 'self' 'unsafe-eval' 'unsafe-inline';");
        expect(policy).toContain("img-src 'self' data: blob:;");
        expect(policy).toContain("style-src 'self' 'unsafe-inline';");
    });
});
