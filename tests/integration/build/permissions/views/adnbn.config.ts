import {defineConfig} from "adnbn";

export default defineConfig({
    name: "View Permissions Integration",
    description:
        "Build fixture collecting permissions declared by popup, sidebar, options, page and offscreen entrypoints.",
    version: "1.0.0",
    multiplePopup: true,
    multipleSidebar: true,
});
