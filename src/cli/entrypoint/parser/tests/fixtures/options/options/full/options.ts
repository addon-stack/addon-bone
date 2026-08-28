import {Browser, CspSource, defineOptions, Mode} from "adnbn";

import {openInTab} from "./values";

export default defineOptions({
    openInTab,
    as: "settings",
    title: "Extension options",
    template: "./template.html",
    includeApp: ["app"],
    excludeApp: ["legacy"],
    includeBrowser: [Browser.Chrome],
    excludeBrowser: [Browser.Safari],
    mode: Mode.Production,
    debug: true,
    manifestVersion: 3,
    csp: {
        wasm: true,
        sources: {
            connect: [CspSource.Self, "https://api.example.com"],
            image: [CspSource.Self, "data:", "blob:"],
            style: [CspSource.Self, CspSource.UnsafeInline],
        },
    },
    scripts: "extra.js",
    links: "extra.css",
    metas: {
        attributes: {
            name: "options-test",
            content: "enabled",
        },
    },
    render: ({title}) => title,
});
