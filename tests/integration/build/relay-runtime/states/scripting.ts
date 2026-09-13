import {defineRelay, RelayMethod, ContentScriptDeclarative} from "adnbn";

export default defineRelay({
    name: "collector",
    method: RelayMethod.Scripting,
    declarative: ContentScriptDeclarative.Required,
    matches: ["https://example.com/*"],
    allFrames: false,
    init: () => ({ready: () => true}),
});
