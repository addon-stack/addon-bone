import {defineSidebar} from "adnbn";
import {reportView} from "./report-view";

export default defineSidebar({
    title: "Account document",
    label: "@sidebar.account",
    icon: "account",
    render: ({title}) => reportView("sidebar", title),
});
