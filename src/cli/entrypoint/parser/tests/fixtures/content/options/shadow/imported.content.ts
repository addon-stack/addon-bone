import {defineContentScript} from "adnbn";
import {mode} from "./mode";
export default defineContentScript({isolation: {type: "shadow", mode}});
