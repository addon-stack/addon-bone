import {defineOffscreen} from "adnbn";

export default defineOffscreen({
    name: "audio",
    init: () => ({
        volume: 1,
        play: (url: string): void => console.log(url),
    }),
});
