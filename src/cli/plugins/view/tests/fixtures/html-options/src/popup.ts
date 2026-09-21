import {Browser, definePopup, Mode} from "adnbn";

export default definePopup({
    title: "Popup",
    icon: "toolbar",
    apply: true,
    mode: Mode.Production,
    debug: false,
    manifestVersion: 3,
    includeBrowser: [Browser.Chrome],
    csp: {sources: {connect: ["https://api.example.com"]}},
    links: "popup.css",
    metas: {attributes: {name: "viewport", content: "width=device-width"}},
    render: () => "Popup",
});
