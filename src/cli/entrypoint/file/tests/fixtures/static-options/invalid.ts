import {ContentScriptIsolation} from "adnbn";
import resource from "./resource.svg";

const first = second;
const second = first;
export const unresolved = {type: shadow};
export const dynamic = {page: computePage()};
export const spread = {type: "iframe", ...unknown};
export const computed = {[computeKey()]: "iframe"};
export const method = {value() { return "iframe"; }};
export const cycle = first;
export const asset = resource;
export const unknownEnum = ContentScriptIsolation.Unknown;
export let mutable = "shadow";
export const {destructured} = computeOptions();
