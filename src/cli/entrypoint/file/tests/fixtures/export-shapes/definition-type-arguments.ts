import {defineService, Browser} from "adnbn";

interface MathApi {
    sum(a: number, b: number): number;
}

export default defineService<MathApi>({
    name: "math",
    includeBrowser: [Browser.Firefox],
    init: () => ({sum: (a, b) => a + b}),
});
