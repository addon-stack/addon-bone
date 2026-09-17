import {defineNewtab} from "adnbn";

export default defineNewtab({
    title: "Custom newtab",
    excludeBrowser: ["chrome", "chromium", "edge"],
    csp: {sources: {connect: ["https://newtab.example.com"]}},
    render: () => "Custom newtab",
});
