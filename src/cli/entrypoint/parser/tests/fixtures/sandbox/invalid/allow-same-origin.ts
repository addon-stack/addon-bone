import {defineSandbox} from "adnbn";

export default defineSandbox({
    name: "sameOrigin",
    csp: {
        allow: ["same-origin"],
    },
    init() {
        return {};
    },
});
