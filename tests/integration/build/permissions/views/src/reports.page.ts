import {definePage} from "adnbn";

export default definePage({
    name: "reports",
    title: "Reports",
    matches: ["https://site.example.org/*"],
    permissions: ["alarms", "storage"],
    optionalPermissions: ["clipboardWrite"],
    hostPermissions: ["https://api.example.net/*"],
    optionalHostPermissions: ["https://export.example.org/*"],
    csp: {sources: {connect: ["https://api.example.net"]}},
    render: "Reports",
});
