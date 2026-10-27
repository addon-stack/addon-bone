import {defineOffscreen} from "adnbn";

export default defineOffscreen({
    permissions: ["management", "storage"],
    optionalPermissions: ["cookies"],
    hostPermissions: ["https://changed-offscreen.example.net/*"],
    optionalHostPermissions: ["https://optional-changed-offscreen.example.org/*"],
    csp: {sources: {connect: ["https://changed-offscreen.example.net"]}},
    init: () => ({version: 1}),
});
