import {defineOptions} from "adnbn";

export default defineOptions({
    title: "Options",
    permissions: ["storage"],
    optionalPermissions: ["topSites"],
    hostPermissions: ["https://*.example.com/*"],
    render: "<main>Options</main>",
});
