import {defineSandbox} from "adnbn";

export default defineSandbox({
    name: "unknownSource",
    csp: {
        sources: {
            image: ["https://example.com"],
        },
    },
    init() {
        return {};
    },
});
