import {definePopup} from "adnbn";

// Not applied by default, but still built and reachable through changePopup().
export default definePopup({
    title: "Settings popup",
    apply: false,
    permissions: ["downloads"],
    render: "<main>Settings popup</main>",
});
