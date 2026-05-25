import {defineSandbox} from "adnbn";

import {readyTimeout, requestTimeout, sandboxCsp, sandboxName} from "./options";

export default defineSandbox({
    name: sandboxName,
    readyTimeout,
    requestTimeout,
    csp: sandboxCsp,
    init() {
        return {};
    },
});
