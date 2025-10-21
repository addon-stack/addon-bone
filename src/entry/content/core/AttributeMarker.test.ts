import AttributeMarker from "./AttributeMarker";
import {ContentScriptMarkerValue, ContentScriptMarkerContract} from "@typing/content";

describe("AttributeMarker", () => {
    const attr = "data-marker";
    let marker: ContentScriptMarkerContract;

    beforeEach(() => {
        document.body.innerHTML = "";

        marker = new AttributeMarker(undefined, attr);
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
        expect(el.getAttribute(attr)).toBe(ContentScriptMarkerValue.Mounted);
        expect(marker.value(el)).toBe(ContentScriptMarkerValue.Mounted);

        marker.unmount(el);
        expect(marker.isMarked(el)).toBe(true);
        expect(el.getAttribute(attr)).toBe(ContentScriptMarkerValue.Unmounted);
        expect(marker.value(el)).toBe(ContentScriptMarkerValue.Unmounted);

        marker.unmark(el);
        expect(marker.isMarked(el)).toBe(false);
        expect(marker.value(el)).toBeUndefined();
    });

    test("value() is undefined for invalid attribute values", () => {
        const el = document.createElement("div");
        el.setAttribute(attr, "foo");
        document.body.append(el);

        expect(marker.isMarked(el)).toBe(true);
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

        test("invalid CSS selector is handled and returns []", () => {
            // Use a selector that certainly causes a SyntaxError in querySelectorAll (unbalanced parenthesis)
            expect(marker.for("(").unmarked()).toEqual([]);
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

        test("invalid XPath is handled and returns []", () => {
            // Use an obviously invalid XPath (unterminated predicate) to trigger error handling
            expect(marker.for("//*[").marked()).toEqual([]);
        });
    });

    test("mount/unmount shortcuts", () => {
        const el = document.createElement("div");
        document.body.append(el);

        marker.mount(el);
        expect(el.getAttribute(attr)).toBe(ContentScriptMarkerValue.Mounted);

        marker.unmount(el);
        expect(el.getAttribute(attr)).toBe(ContentScriptMarkerValue.Unmounted);
    });

    test("reset() removes attribute from all marked in current anchor", () => {
        const a1 = Object.assign(document.createElement("div"), {className: "anchor"});
        const a2 = Object.assign(document.createElement("div"), {className: "anchor"});
        const a3 = Object.assign(document.createElement("div"), {className: "anchor"});
        document.body.append(a1, a2, a3);

        const m = marker.for(".anchor");
        m.mark(a1, ContentScriptMarkerValue.Mounted);
        m.mark(a3, ContentScriptMarkerValue.Unmounted);

        expect(m.marked()).toEqual([a1, a3]);

        m.reset();
        expect(m.marked()).toEqual([]);
        expect(a1.hasAttribute(attr)).toBe(false);
        expect(a3.hasAttribute(attr)).toBe(false);
    });

    test("for() is chainable and changes context", () => {
        const a = Object.assign(document.createElement("div"), {className: "a"});
        const b = Object.assign(document.createElement("div"), {className: "b"});
        document.body.append(a, b);

        expect(marker.for(".a").unmarked()).toEqual([a]);
        expect(marker.for(".b").unmarked()).toEqual([b]);
    });
});
