import {definePopup} from "adnbn";

export default definePopup({
    title: "Main popup",
    permissions: ["tabs", "storage"],
    hostPermissions: ["https://*.example.com/*"],
    render: () => "Main popup",
});
