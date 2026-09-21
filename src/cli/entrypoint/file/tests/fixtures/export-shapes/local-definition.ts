import {Browser} from "adnbn";

const defineBackground = <T>(definition: T): T => definition;

export const excludeBrowser = [Browser.Edge];

export default defineBackground({
    persistent: true,
    includeBrowser: [Browser.Firefox],
});
