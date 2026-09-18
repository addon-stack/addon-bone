import {Browser, CspSource, defineSidebar} from "adnbn";

export default defineSidebar({
    as: "panel",
    title: "Extension panel",
    template: "./template.html",
    icon: "toolbar",
    apply: false,
    includeBrowser: [Browser.Chrome],
    csp: {sources: {connect: [CspSource.Self, "https://api.example.com"]}},
    links: "extra.css",
    render: ({title}) => title,
});
