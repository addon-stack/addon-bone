import {Browser, defineCommand} from "adnbn";

export default defineCommand({
    includeBrowser: [Browser.Firefox],
    defaultKey: "Ctrl+Alt+Y",
    macKey: "Command+Alt+Y",
    linuxKey: "F12",
    chromeosKey: "Search+Ctrl+Shift+Y",
    description: "Firefox shortcut",
    execute() {},
});
