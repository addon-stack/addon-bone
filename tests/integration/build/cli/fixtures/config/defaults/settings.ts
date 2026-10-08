import path from "node:path";
import {Browser, Mode, type UserConfig} from "adnbn";

export const settings: UserConfig = {
    app: "reader",
    browser: Browser.Safari,
    mode: Mode.Development,
    version: "1.2.3",
    srcDir: path.join("defaults", "src"),
};
