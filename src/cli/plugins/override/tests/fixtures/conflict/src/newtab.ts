import {defineNewtab} from "adnbn";

export default defineNewtab({
    title: "Custom newtab",
    csp: {sources: {connect: ["https://newtab.example.com"]}},
    render: () => "Custom newtab",
});
