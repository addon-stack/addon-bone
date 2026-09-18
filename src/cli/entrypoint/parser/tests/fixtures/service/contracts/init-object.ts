import {defineService} from "adnbn";

export default defineService({
    name: "math",
    init: () => ({
        version: "1.0.0",
        sum: (a: number, b: number): number => a + b,
    }),
});
