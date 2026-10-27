import type {ViewOptions} from "adnbn";
import {reportView} from "./report-view";

export const title = "Settings document";
export const label = "Open settings";
export const icon = "settings";
export const apply = false;
export const render = (props: ViewOptions) => reportView("settings", props.title);
