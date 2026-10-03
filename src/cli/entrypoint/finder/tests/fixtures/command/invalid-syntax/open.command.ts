import {Browser, defineCommand} from "adnbn";

export default defineCommand({
    includeBrowser: [Browser.Firefox],
    defaultKey: "Ctrl+UnlistedKey",
    execute() {},
});
