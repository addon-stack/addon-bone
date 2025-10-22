import WeakMarker from "@entry/content/core/WeakMarker";

describe("WeakMarker — specifics", () => {
    test("does not mutate DOM (no attributes)", () => {
        const marker = new WeakMarker();
        const el = document.createElement("div");
        document.body.append(el);

        marker.mount(el);
        expect(el.getAttributeNames()).toEqual([]);
    });

    test("unmark returns false for non-marked element", () => {
        const marker = new WeakMarker();
        const el = document.createElement("div");
        document.body.append(el);

        expect(marker.unmark(el)).toBe(false);
        marker.mount(el);
        expect(marker.unmark(el)).toBe(true);
    });

    test("state is not shared between instances", () => {
        const m1 = new WeakMarker();
        const m2 = new WeakMarker();

        const el = document.createElement("div");
        document.body.append(el);

        m1.mount(el);

        expect(m1.isMarked(el)).toBe(true);
        expect(m2.isMarked(el)).toBe(false);
    });
});
