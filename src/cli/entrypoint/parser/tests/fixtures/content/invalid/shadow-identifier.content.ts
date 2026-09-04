import {defineContentScript} from "adnbn";

declare const SOME_IMPORTED_FLAG: boolean;

export default defineContentScript({
    shadow: SOME_IMPORTED_FLAG,
});
