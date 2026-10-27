import {defineCommand} from "adnbn";

export default defineCommand({
    includeApp: ["firefox-functions"],
    defaultKey: "F1",
    windowsKey: "Shift+F12",
    macKey: "Command+MacCtrl+Y",
    linuxKey: "Ctrl+Alt+Y",
    chromeosKey: "Search+Ctrl+Shift+Y",
    execute() {},
});
