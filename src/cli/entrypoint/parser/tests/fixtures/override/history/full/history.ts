import {Browser, CspSource, defineHistory, Mode} from "adnbn";

export default defineHistory({
    as: "dashboard",
    title: "History override",
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
            name: "history-test",
            content: "enabled",
        },
    },
    render: ({title}) => title,
});
