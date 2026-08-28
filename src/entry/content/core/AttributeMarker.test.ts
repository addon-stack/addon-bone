import AttributeMarker from "@entry/content/core/AttributeMarker";
import {ContentScriptMarkerContract, ContentScriptMarkerValue} from "@typing/content";

describe("AttributeMarker — specifics", () => {
    const attr = "data-marker";
    let marker: ContentScriptMarkerContract;

    beforeEach(() => {
        document.body.innerHTML = "";
        marker = new AttributeMarker(undefined, attr);
    });

    test("mount/unmount set DOM attribute values", () => {
        const el = document.createElement("div");
        document.body.append(el);

        marker.mount(el);
        expect(el.getAttribute(attr)).toBe(ContentScriptMarkerValue.Mounted);

        marker.unmount(el);
        expect(el.getAttribute(attr)).toBe(ContentScriptMarkerValue.Unmounted);
    });

    test("value() is undefined for invalid attribute values while attribute exists", () => {
        const el = document.createElement("div");
        el.setAttribute(attr, "foo");
        document.body.append(el);

        expect(marker.isMarked(el)).toBe(true);
        expect(marker.value(el)).toBeUndefined();
    });

    test("reset() removes attribute from all marked elements in current anchor", () => {
        const a1 = Object.assign(document.createElement("div"), {className: "anchor"});
        const a2 = Object.assign(document.createElement("div"), {className: "anchor"});
        const a3 = Object.assign(document.createElement("div"), {className: "anchor"});
        document.body.append(a1, a2, a3);

        const m = marker.for(".anchor");
        m.mark(a1, ContentScriptMarkerValue.Mounted);
        m.mark(a3, ContentScriptMarkerValue.Unmounted);

        expect(m.marked().length).toBe(2);

        m.reset();
        expect(a1.hasAttribute(attr)).toBe(false);
        expect(a3.hasAttribute(attr)).toBe(false);
    });
});
