import {defineBackground, Browser} from "adnbn";

export const persistent = true;

export const includeBrowser = [Browser.Edge];

export const excludeBrowser = [Browser.Opera];

export default defineBackground({
    persistent: false,
    includeBrowser: [Browser.Firefox],
    main: async () => {
        console.log("test background main");
    },
});
