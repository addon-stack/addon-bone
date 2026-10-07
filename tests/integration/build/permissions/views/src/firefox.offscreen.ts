import {Browser, defineOffscreen} from "adnbn";

export default defineOffscreen({
    includeBrowser: [Browser.Firefox],
    permissions: ["webRequest"],
    optionalPermissions: ["sessions"],
    hostPermissions: ["https://firefox-offscreen.example.net/*"],
    optionalHostPermissions: ["https://optional-firefox-offscreen.example.org/*"],
    csp: {sources: {connect: ["https://firefox-offscreen.example.net"]}},
    init: () => ({version: 1}),
});
