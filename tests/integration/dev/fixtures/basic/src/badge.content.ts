import {defineContentScript} from "adnbn";

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    render() {
        const badge = document.createElement("aside");

        badge.dataset.testid = "dev-basic-badge";
        badge.textContent = "Dev basic content";

        return badge;
    },
});
