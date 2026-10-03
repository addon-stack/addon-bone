import {Browser, defineCommand} from "adnbn";

export default defineCommand({
    excludeBrowser: [Browser.Firefox, Browser.Safari],
    defaultKey: "Ctrl+Tab",
    chromeosKey: "Search+Shift+Y",
    execute() {},
});
