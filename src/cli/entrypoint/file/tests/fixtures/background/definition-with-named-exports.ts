import {defineBackground, Browser} from "adnbn";

console.log("test background");

export const persistent = true;

export const excludeBrowser = [Browser.Edge];

export const someNonExportedValue = "some value";

export default defineBackground({
    includeBrowser: [Browser.Firefox],
    main: async () => {
        console.log("test background main");
    },
});
