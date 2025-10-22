import {defineBackground, Browser} from "adnbn";

console.log("test background");

const persistent: boolean = true;

export default defineBackground({
    persistent,
    includeBrowser: [Browser.Firefox],
    main: async () => {
        console.log("test background main");
    },
});
