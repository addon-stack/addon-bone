import {testOverridePage} from "./override-utils";

jest.setTimeout(90_000);

testOverridePage({
    page: "bookmarks",
    permission: "bookmarks",
    supported: ["chrome", "edge"],
    unsupported: ["firefox", "safari", "opera"],
});
