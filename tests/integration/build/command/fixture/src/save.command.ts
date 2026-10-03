import {defineCommand} from "adnbn";

export default defineCommand({
    name: "save-page",
    description: "Save the page",
    global: false,
    defaultKey: "Ctrl+Shift+Y",
    windowsKey: "Alt+Shift+U",
    macKey: "Command+MacCtrl+Y",
    chromeosKey: "Search+Shift+Y",
    linuxKey: "Ctrl+Shift+L",
    execute() {},
});
