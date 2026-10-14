import {defineSidebar} from "adnbn";
import {reportView} from "./report-view";

export default defineSidebar({
    label: "",
    apply: false,
    render: ({title}) => reportView("empty", title),
});
