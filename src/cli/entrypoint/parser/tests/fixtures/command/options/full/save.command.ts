import {Browser, defineCommand} from "adnbn";

export default defineCommand({
    name: "save",
    description: "Save the page",
    global: false,
    defaultKey: "Ctrl+Shift+K",
    windowsKey: "Alt+Shift+U",
    macKey: "Command+Shift+K",
    chromeosKey: "Search+K",
    linuxKey: "Ctrl+Y",
    persistent: true,
    permissions: ["storage", "tabs"],
    optionalPermissions: ["history"],
    hostPermissions: ["https://*.example.com/*"],
    optionalHostPermissions: ["https://other.test/*"],
    excludeBrowser: [Browser.Firefox],
    execute() {},
});
