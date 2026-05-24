import {defineSandbox, SandboxAllow, SandboxSource} from "adnbn";

export default defineSandbox({
    name: "cspSandbox",
    csp: {
        inline: true,
        allow: [SandboxAllow.Forms],
        sources: {
            worker: [SandboxSource.Blob],
        },
    },
    init: () => ({}),
});
