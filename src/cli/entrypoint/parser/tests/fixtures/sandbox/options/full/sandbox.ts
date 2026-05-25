import {Browser, defineSandbox, Mode, SandboxAllow, SandboxSource} from "adnbn";

export default defineSandbox({
    as: "unsafe-parser-frame",
    title: "Unsafe parser",
    template: "./template.html",
    includeApp: ["admin"],
    excludeApp: ["legacy"],
    includeBrowser: [Browser.Chrome],
    excludeBrowser: [Browser.Firefox],
    mode: Mode.Production,
    debug: true,
    manifestVersion: 3,
    name: "parser",
    readyTimeout: 1000,
    requestTimeout: 2000,
    removeOnRequestTimeout: true,
    csp: {
        eval: true,
        inline: false,
        allow: [SandboxAllow.Forms, "modals"],
        sources: {
            connect: [SandboxSource.Self],
            image: [SandboxSource.Self, "data:", "blob:"],
            style: [SandboxSource.Self, SandboxSource.UnsafeInline],
            font: ["'self'"],
            media: ["blob:"],
            worker: [SandboxSource.Blob],
            child: [SandboxSource.Self],
        },
    },
    scripts: "extra.js",
    links: "extra.css",
    metas: {
        attributes: {
            name: "sandbox-test",
            content: "enabled",
        },
    },
    init() {
        return {};
    },
});
