import {Browser, definePopup, Mode} from "adnbn";

export default definePopup({
    title: "Popup",
    icon: "toolbar",
    mode: Mode.Production,
    debug: false,
    manifestVersion: 3,
    includeBrowser: [Browser.Chrome],
    csp: {wasm: true},
    render: () => "Popup",
});
