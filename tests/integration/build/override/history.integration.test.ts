import {testOverridePage} from "./override-utils";

jest.setTimeout(90_000);

testOverridePage({
    page: "history",
    permission: "history",
    supported: ["chrome", "edge"],
    unsupported: ["firefox", "safari", "opera"],
});
