import {defineBackground, Browser} from "adnbn";

console.log("test background");

export default defineBackground({
    persistent: true,
    includeBrowser: [Browser.Firefox],
    main: async () => {
        console.log("test background main");
    },
});
