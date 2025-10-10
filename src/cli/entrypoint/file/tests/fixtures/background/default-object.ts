import {Browser} from "adnbn";

console.log("test background");

export const persistent = true;

export const excludeBrowser = [Browser.Opera];

export default {
    includeBrowser: [Browser.Chrome],
    main: async () => {
        console.log("test background main");
    },
};
