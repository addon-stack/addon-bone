import AttributeMarker from "./AttributeMarker";
import WeakMarker from "./WeakMarker";

import {ContentScriptMarkerContract, ContentScriptMarkerValue} from "@typing/content";

const implementations: Array<[name: string, factory: () => ContentScriptMarkerContract]> = [
    ["AttributeMarker", () => new AttributeMarker(undefined, "data-marker")],
    ["WeakMarker", () => new WeakMarker()],
];

describe.each(implementations)("Marker: %s", (_name, create) => {
    let marker: ContentScriptMarkerContract;

    beforeEach(() => {
        document.body.innerHTML = "";
        marker = create();
    });

    test("returns empty lists without anchor", () => {
        expect(marker.unmarked()).toEqual([]);
        expect(marker.marked()).toEqual([]);
    });

    test("isMarked/mark/unmount/unmark/value", () => {
        const el = document.createElement("div");
        document.body.append(el);

        expect(marker.isMarked(el)).toBe(false);
        expect(marker.value(el)).toBeUndefined();

        marker.mark(el, ContentScriptMarkerValue.Mounted);
        expect(marker.isMarked(el)).toBe(true);
        expect(marker.value(el)).toBe(ContentScriptMarkerValue.Mounted);

        marker.unmount(el);
        expect(marker.isMarked(el)).toBe(true);
        expect(marker.value(el)).toBe(ContentScriptMarkerValue.Unmounted);

        marker.unmark(el);
        expect(marker.isMarked(el)).toBe(false);
        expect(marker.value(el)).toBeUndefined();
    });

    describe("Element anchor", () => {
        test("unmarked()/marked() with single element", () => {
            const el = document.createElement("div");
            document.body.append(el);

            expect(marker.for(el).unmarked()).toEqual([el]);
            expect(marker.for(el).marked()).toEqual([]);

            marker.mark(el, ContentScriptMarkerValue.Mounted);
            expect(marker.for(el).unmarked()).toEqual([]);
            expect(marker.for(el).marked()).toEqual([el]);
        });
    });

    describe("CSS anchor", () => {
        test("lists unmarked and marked by selector", () => {
            const a1 = Object.assign(document.createElement("div"), {className: "anchor"});
            const a2 = Object.assign(document.createElement("div"), {className: "anchor"});
            const a3 = Object.assign(document.createElement("div"), {className: "anchor"});
            document.body.append(a1, a2, a3);

            expect(marker.for(".anchor").unmarked()).toEqual([a1, a2, a3]);

            marker.mark(a2, ContentScriptMarkerValue.Mounted);
            expect(marker.for(".anchor").unmarked()).toEqual([a1, a3]);
            expect(marker.for(".anchor").marked()).toEqual([a2]);
        });

        test("invalid CSS selector handled and returns []", () => {
            const spy = jest.spyOn(console, "error").mockImplementation(() => {});
            expect(marker.for("(").unmarked()).toEqual([]);
            spy.mockRestore();
        });
    });

    describe("XPath anchor", () => {
        test("lists unmarked and marked by XPath", () => {
            const d1 = document.createElement("div");
            d1.setAttribute("data-role", "x");
            const d2 = document.createElement("div");
            d2.setAttribute("data-role", "x");
            const d3 = document.createElement("div");
            d3.setAttribute("data-role", "y");
            document.body.append(d1, d2, d3);

            const xp = "//div[@data-role='x']";
            expect(marker.for(xp).unmarked()).toEqual([d1, d2]);

            marker.mark(d2, ContentScriptMarkerValue.Mounted);
            expect(marker.for(xp).unmarked()).toEqual([d1]);
            expect(marker.for(xp).marked()).toEqual([d2]);
        });

        test("invalid XPath handled and returns []", () => {
            const spy = jest.spyOn(console, "error").mockImplementation(() => {});
            expect(marker.for("//*[").marked()).toEqual([]);
            spy.mockRestore();
        });
    });

    test("reset() removes marks only in current anchor", () => {
        const a1 = Object.assign(document.createElement("div"), {className: "a"});
        const a2 = Object.assign(document.createElement("div"), {className: "a"});
        const b1 = Object.assign(document.createElement("div"), {className: "b"});
        const b2 = Object.assign(document.createElement("div"), {className: "b"});
        document.body.append(a1, a2, b1, b2);

        marker.mark(a1, ContentScriptMarkerValue.Mounted);
        marker.mark(b1, ContentScriptMarkerValue.Mounted);

        const forA = marker.for(".a");
        expect(forA.marked()).toEqual([a1]);

        forA.reset();

        expect(forA.marked()).toEqual([]);
        expect(marker.for(".b").marked()).toEqual([b1]);
    });

    test("for() is chainable and changes context", () => {
        const a = Object.assign(document.createElement("div"), {className: "a"});
        const b = Object.assign(document.createElement("div"), {className: "b"});
        document.body.append(a, b);

        expect(marker.for(".a").unmarked()).toEqual([a]);
        expect(marker.for(".b").unmarked()).toEqual([b]);
    });
});
