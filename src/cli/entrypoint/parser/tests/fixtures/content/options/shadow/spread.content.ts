import {defineContentScript} from "adnbn";
const options = {mode: "closed"};
export default defineContentScript({isolation: {type: "shadow", ...options}});
