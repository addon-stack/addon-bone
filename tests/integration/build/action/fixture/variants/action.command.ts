import {defineExecuteActionCommand} from "adnbn";

export default defineExecuteActionCommand({
    defaultKey: "Ctrl+Shift+Y",
    execute() {
        console.info("Action clicked");
    },
});
