import {BackgroundDefinition, Browser} from "adnbn";

console.log("test background");

export const persistent = true;

export default {
    includeBrowser: [Browser.Chromium],
    main: async () => {
        console.log("test background main");
    },
} satisfies BackgroundDefinition;
