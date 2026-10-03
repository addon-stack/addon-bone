import {defineCommand} from "adnbn";

export default defineCommand({
    includeApp: ["global-fallback"],
    defaultKey: "Ctrl+Y",
    global: true,
    windowsKey: "Ctrl+Shift+1",
    macKey: "Command+Shift+3",
    execute() {},
});
