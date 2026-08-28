import {defineBackground} from "adnbn";

declare global {
    var __adnbnOptionsReady: boolean | undefined;
}

export default defineBackground({
    main() {
        globalThis.__adnbnOptionsReady = true;
    },
});
