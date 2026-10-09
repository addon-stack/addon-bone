import {definePopup} from "adnbn";
import {reportView} from "./report-view";

export default definePopup({
    title: "Account document",
    tooltip: "@popup.account",
    render: props => reportView("popup", props.title),
});
