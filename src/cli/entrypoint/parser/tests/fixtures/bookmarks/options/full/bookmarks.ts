import {Browser, CspSource, defineBookmarks, Mode} from "adnbn";

export default defineBookmarks({
    as: "dashboard",
    title: "Bookmarks override",
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
    permissions: ["storage", "tabs"],
    optionalPermissions: ["topSites"],
    hostPermissions: ["https://*.example.com/*"],
    optionalHostPermissions: ["https://other.test/*"],
    scripts: "extra.js",
    links: "extra.css",
    metas: {
        attributes: {
            name: "bookmarks-test",
            content: "enabled",
        },
    },
    render: ({title}) => title,
});
