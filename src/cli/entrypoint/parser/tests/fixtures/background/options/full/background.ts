import {Browser, defineBackground, Mode} from "adnbn";

export default defineBackground({
    persistent: true,
    permissions: ["storage", "tabs"],
    optionalPermissions: ["history"],
    hostPermissions: ["https://*.example.com/*"],
    optionalHostPermissions: ["https://other.test/*"],
    includeApp: ["app"],
    excludeBrowser: [Browser.Safari],
    mode: Mode.Production,
    main() {},
});
