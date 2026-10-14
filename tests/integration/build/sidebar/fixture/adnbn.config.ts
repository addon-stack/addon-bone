import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Sidebar contract test",
    version: "1.0.0",
    multipleSidebar: true,
    action: {title: "Independent toolbar"},
    specific: {gecko: {id: "sidebar-contract@adnbn.test"}},
});
