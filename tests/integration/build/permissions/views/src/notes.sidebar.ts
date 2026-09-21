import {defineSidebar} from "adnbn";

// Not applied by default, but still built and reachable through changeSidebar().
export default defineSidebar({
    title: "Notes sidebar",
    apply: false,
    permissions: ["history"],
    render: "<main>Notes sidebar</main>",
});
