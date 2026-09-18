import {Browser, CspSource, defineNewtab, Mode} from "adnbn";

export default defineNewtab({
    as: "dashboard",
    title: "New tab override",
    template: "./template.html",
    includeApp: ["app"],
    excludeApp: ["legacy"],
    includeBrowser: [Browser.Chrome],
    excludeBrowser: [Browser.Opera],
    mode: Mode.Production,
    debug: true,
    manifestVersion: 3,
    csp: {
        wasm: true,
        sources: {
            connect: [CspSource.Self, "https://api.example.com"],
            image: [CspSource.Self, "data:", "blob:"],
        },
    },
    scripts: "extra.js",
    links: "extra.css",
    metas: {
        attributes: {
            name: "newtab-test",
            content: "enabled",
        },
    },
    render: ({title}) => title,
});
