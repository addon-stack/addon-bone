import {BackgroundDefinition, Browser} from "adnbn";

console.log("test background");

export const persistent = true;

export const excludeBrowser = [Browser.Safari];

export default {
    includeBrowser: [Browser.Chromium],
    main: async () => {
        console.log("test background main");
    },
} as BackgroundDefinition;
