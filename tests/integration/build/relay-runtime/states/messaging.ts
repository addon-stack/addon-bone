import {defineRelay} from "adnbn";

export default defineRelay({
    name: "observer",
    init: () => ({ready: () => true}),
});
