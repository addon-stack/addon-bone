import {defineNewtab} from "adnbn";

export default defineNewtab({
    title: "Custom newtab",
    csp: {sources: {connect: ["https://newtab.example.com"]}},
    permissions: ["search"],
    optionalPermissions: ["topSites"],
    hostPermissions: ["https://*.example.com/*"],
    optionalHostPermissions: ["https://other.test/*"],
    render: () => "Custom newtab",
});
