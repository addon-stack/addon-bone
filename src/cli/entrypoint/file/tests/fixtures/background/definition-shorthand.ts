import {Browser, defineBackground} from "adnbn";
import {APP_NAME, permissions} from "./config-for-test";

const persistent = true;

const excludeBrowser = [Browser.Edge];

const includeBrowser = [Browser.Firefox];

const excludeApp: string[] = [APP_NAME];

export default defineBackground({
    permissions,
    persistent,
    excludeBrowser,
    includeBrowser,
    excludeApp,
    main: async () => {
        console.log("test background main");
    },
});
