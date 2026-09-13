import {defineService} from "adnbn";

export default defineService({
    name: "offscreenTest",
    init: () => ({
        echo(value: string) {
            return `background:${value}`;
        },
    }),
});
