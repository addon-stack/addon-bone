import {defineSandbox} from "adnbn";

import {TemplateSandbox} from "./api";

export default defineSandbox({
    name: "importedClassContract",
    init() {
        return new TemplateSandbox();
    },
});
