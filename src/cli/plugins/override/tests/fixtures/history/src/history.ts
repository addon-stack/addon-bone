import {defineHistory} from "adnbn";

export default defineHistory({
    title: "Custom history",
    csp: {sources: {connect: ["https://history.example.com"]}},
    render: () => "Custom history",
});
