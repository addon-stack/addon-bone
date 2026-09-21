import {definePopup} from "adnbn";

export default definePopup({
    title: "Main popup",
    permissions: ["tabs"],
    render: "<main>Main popup</main>",
});
