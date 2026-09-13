import {defineBackground, getOffscreen} from "adnbn";

declare global {
    var __adnbnRunOffscreenRoundTrip: (() => Promise<string>) | undefined;
}

export default defineBackground({
    main() {
        globalThis.__adnbnRunOffscreenRoundTrip = () => getOffscreen("offscreenTest").callBackground();
    },
});
