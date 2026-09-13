import {definePage} from "adnbn";
export default definePage({
    name: "panel",
    matches: ["http://127.0.0.1/*"],
    render() {
        const panel = document.createElement("strong");
        panel.textContent = "Extension page loaded";
        parent.postMessage("adnbn-page-ready", "*");
        return panel;
    },
});
