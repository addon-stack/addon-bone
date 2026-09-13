import {defineRelay} from "adnbn";

export default defineRelay({
    isolation: {type: "iframe", page: "panel"},
    init() {
        return {};
    },
});
