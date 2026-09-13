import {defineContentScript} from "adnbn";
import {shadow} from "./unresolved-isolation-type";
export default defineContentScript({isolation: {type: shadow}});
