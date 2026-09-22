import {definePopup} from "adnbn";

export default definePopup({
    title: "Settings popup",
    apply: false,
    permissions: ["tabs", "downloads"],
    optionalPermissions: ["topSites"],
    optionalHostPermissions: ["https://other.test/*"],
    render: () => "Settings popup",
});
