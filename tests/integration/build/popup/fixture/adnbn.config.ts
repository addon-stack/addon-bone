import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Popup contract test",
    version: "1.0.0",
    multiplePopup: true,
    action: {title: "Common tooltip"},
    specific: {gecko: {id: "popup-contract@adnbn.test"}},
});
