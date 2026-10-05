import {Browser, definePage} from "adnbn";

export default definePage({
    name: "notifications",
    includeBrowser: [Browser.Firefox],
    permissions: ["notifications"],
    optionalPermissions: ["idle"],
    hostPermissions: ["https://firefox.example.net/*"],
    optionalHostPermissions: ["https://optional-firefox.example.org/*"],
    csp: {sources: {connect: ["https://firefox.example.net"]}},
    render: "Notifications",
});
