import {Browser, CspSource, definePopup} from "adnbn";

export default definePopup({
    as: "panel",
    title: "Extension panel",
    template: "./template.html",
    icon: "toolbar",
    apply: false,
    includeBrowser: [Browser.Chrome],
    csp: {sources: {connect: [CspSource.Self, "https://api.example.com"]}},
    permissions: ["storage", "tabs"],
    optionalPermissions: ["topSites"],
    hostPermissions: ["https://*.example.com/*"],
    optionalHostPermissions: ["https://other.test/*"],
    links: "extra.css",
    render: ({title}) => title,
});
