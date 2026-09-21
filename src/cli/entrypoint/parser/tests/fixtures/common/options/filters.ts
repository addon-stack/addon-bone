import {Browser, defineBackground, Mode} from "adnbn";

export default defineBackground({
    includeApp: ["app"],
    excludeApp: ["legacy"],
    includeBrowser: [Browser.Chrome, Browser.Edge],
    excludeBrowser: [Browser.Safari],
    mode: Mode.Development,
    debug: false,
    manifestVersion: 2,
});
