import {defineBookmarks} from "adnbn";

export default defineBookmarks({
    title: "App bookmarks",
    csp: {sources: {connect: ["https://app.example.com"]}},
    render: () => "App bookmarks",
});
