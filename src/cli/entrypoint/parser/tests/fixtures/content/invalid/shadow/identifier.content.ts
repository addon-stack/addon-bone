import {defineContentScript} from "adnbn";
import {closed} from "./unresolved-mode";
export default defineContentScript({isolation: {type: "shadow", mode: closed}});
