import {defineService, Browser} from "adnbn";

export const excludeBrowser = [Browser.Edge];

export default defineService({
    persistent: true,
    includeBrowser: [Browser.Firefox],
    init: () => ({}),
});
