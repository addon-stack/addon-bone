import {defineHistory} from "adnbn";

export default defineHistory({
    title: "App history",
    csp: {sources: {connect: ["https://app.example.com"]}},
    permissions: ["storage"],
    render: () => "App history",
});
