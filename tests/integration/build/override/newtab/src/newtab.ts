import {defineNewtab} from "adnbn";

export default defineNewtab({
    title: "Custom new tab",
    csp: {sources: {connect: ["https://newtab.example.com"]}},
    permissions: ["search"],
    render: "<main>Custom new tab</main>",
});
