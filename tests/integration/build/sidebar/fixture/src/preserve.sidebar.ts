import {defineSidebar} from "adnbn";
import {reportView} from "./report-view";

export default defineSidebar({
    title: "Preserve document",
    apply: false,
    render: ({title}) => reportView("preserve", title),
});
