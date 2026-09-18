import {defineExecuteActionCommand} from "adnbn";

export default defineExecuteActionCommand({
    defaultKey: "Ctrl+Shift+K",
    execute: () => {
        console.log("test command execute");
    },
});
