import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: Page matches must be an array of patterns.
    matches: "https://example.com/*",
});
