import {defineContentScript} from "adnbn";

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    render: () => {
        const element = document.createElement("pre");
        element.id = "sidebar-results";

        chrome.runtime.sendMessage({kind: "inspect-sidebar"}, result => {
            element.textContent = JSON.stringify(
                chrome.runtime.lastError ? {error: chrome.runtime.lastError.message} : result
            );
        });

        return element;
    },
});
