import {defineSandbox} from "adnbn";

export default defineSandbox({
    name: "objectContract",
    init() {
        return {
            parse(html: string): number {
                return html.length;
            },
            version: "1.0.0",
            _private() {
                return "hidden";
            },
        };
    },
});
