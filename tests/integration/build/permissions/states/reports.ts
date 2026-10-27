import {definePage} from "adnbn";

export default definePage({
    name: "reports",
    title: "Reports",
    matches: ["https://site.example.org/*"],
    permissions: ["idle", "storage"],
    optionalPermissions: ["clipboardRead"],
    hostPermissions: ["https://changed.example.net/*"],
    optionalHostPermissions: ["https://changed.example.org/*"],
    csp: {sources: {connect: ["https://changed.example.net"]}},
    render: "Updated reports",
});
