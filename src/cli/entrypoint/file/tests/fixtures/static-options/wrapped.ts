import {defineContentScript, type ContentScriptDefinition} from "adnbn";
import {runtime, closed} from "./settings";

const definition = {...runtime, isolation: {type: "shadow", mode: closed}} as const;
export default defineContentScript((definition) satisfies ContentScriptDefinition);
