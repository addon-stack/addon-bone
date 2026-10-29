import {defineBackground} from "adnbn";

declare global {
    var __adnbnDevBasicBackground: string | undefined;
}

export default defineBackground({
    main() {
        globalThis.__adnbnDevBasicBackground = "ready";
    },
});
