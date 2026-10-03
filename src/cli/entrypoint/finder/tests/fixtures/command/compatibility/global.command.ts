import {Browser, defineCommand} from "adnbn";

export default defineCommand({
    includeBrowser: [Browser.Chrome],
    global: true,
    defaultKey: "Ctrl+Shift+5",
    macKey: "Command+Shift+5",
    execute() {},
});
