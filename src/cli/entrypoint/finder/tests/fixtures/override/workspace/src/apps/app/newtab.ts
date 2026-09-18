import {defineNewtab} from "adnbn";

export default defineNewtab({
    title: "App newtab",
    csp: {sources: {connect: ["https://app.example.com"]}},
    permissions: ["storage"],
    render: () => "App newtab",
});
