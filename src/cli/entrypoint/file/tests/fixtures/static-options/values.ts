import {ContentScriptWorld as World, ContentScriptShadowMode as ShadowMode} from "adnbn";
import imported, {Count as Numbers} from "./settings";

enum Mode {
    Closed = "closed",
}
const key = "sizes";
const shadow = "not the literal";
export const settings = {...imported, [key]: [-1, Numbers.First, 320]};
export const enums = {
    first: Numbers.First,
    next: Numbers.Next,
    named: Mode.Closed,
    world: World.Isolated,
    mode: ShadowMode.Closed,
};
export const literal = "shadow";
const mixed = {height: 320, render: () => document.createElement("div")};
export const selected = mixed.height;
