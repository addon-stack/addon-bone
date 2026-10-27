import {reportView} from "./report-view";

export const title = "Settings document";
export const tooltip = "Open settings";
export const apply = false;

export default (props: {title?: string}) => reportView("settings", props.title);
