import {ContentScriptShadowMode} from "adnbn";

export const closed = ContentScriptShadowMode.Closed;
export const runtime = {render: () => document.createElement("div")};
export enum Count {
    First,
    Next,
}
const settings = {enabled: false, count: 0, label: "", empty: null, missing: undefined};
export default settings;
