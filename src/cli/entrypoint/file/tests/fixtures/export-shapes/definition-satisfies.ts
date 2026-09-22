import {definePopup, Browser, type PopupDefinition} from "adnbn";

export default definePopup({
    title: "Popup",
    excludeBrowser: [Browser.Safari],
    render: () => "Popup",
}) satisfies PopupDefinition;
