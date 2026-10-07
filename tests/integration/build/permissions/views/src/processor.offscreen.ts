import {defineOffscreen} from "adnbn";

export default defineOffscreen({
    permissions: ["geolocation", "storage"],
    optionalPermissions: ["contextMenus"],
    hostPermissions: ["https://offscreen.example.net/*"],
    optionalHostPermissions: ["https://optional-offscreen.example.org/*"],
    csp: {sources: {connect: ["https://offscreen.example.net"]}},
    init: () => ({version: 1}),
});
