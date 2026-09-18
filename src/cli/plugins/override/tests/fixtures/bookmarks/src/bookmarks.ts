import {defineBookmarks} from "adnbn";

export default defineBookmarks({
    title: "Custom bookmarks",
    csp: {sources: {connect: ["https://bookmarks.example.com"]}},
    permissions: ["bookmarks"],
    render: () => "Custom bookmarks",
});
