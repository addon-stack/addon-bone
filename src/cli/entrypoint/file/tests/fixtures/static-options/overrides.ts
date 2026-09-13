import {defineContentScript} from "adnbn";
const defaults = {isolation: computeOptions()};
export const isolation = computeOptions();
export default defineContentScript({
    ...defaults,
    isolation: {type: "shadow", mode: computeMode(), ...{mode: "closed"}},
});
