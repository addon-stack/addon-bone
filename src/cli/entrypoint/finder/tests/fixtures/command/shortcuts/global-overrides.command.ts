import {defineCommand} from "adnbn";

export default defineCommand({
    includeApp: ["global-overrides"],
    defaultKey: "Ctrl+Y",
    global: true,
    windowsKey: "Ctrl+Shift+1",
    linuxKey: "Ctrl+Shift+2",
    macKey: "Command+Shift+3",
    execute() {},
});
