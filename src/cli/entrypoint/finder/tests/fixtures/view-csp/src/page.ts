import {definePage} from "adnbn";

export default definePage({
    name: "help",
    csp: {
        sources: {
            connect: ["https://api.example.com"],
        },
    },
});
