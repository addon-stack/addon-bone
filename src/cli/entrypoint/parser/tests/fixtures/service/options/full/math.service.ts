import {Browser, defineService} from "adnbn";

export default defineService({
    name: "math",
    persistent: true,
    permissions: ["storage", "tabs"],
    optionalPermissions: ["history"],
    hostPermissions: ["https://*.example.com/*"],
    optionalHostPermissions: ["https://other.test/*"],
    includeBrowser: [Browser.Chrome],
    init: () => ({sum: (a: number, b: number) => a + b}),
});
