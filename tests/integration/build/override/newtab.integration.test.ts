import {testOverridePage} from "./override-utils";

jest.setTimeout(90_000);

testOverridePage({
    page: "newtab",
    permission: "search",
    supported: ["chrome", "edge", "firefox", "safari"],
    unsupported: ["opera"],
});
