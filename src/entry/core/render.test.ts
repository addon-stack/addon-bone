import {isDomRenderValue, renderDomValue} from "./render";

describe("DOM render values", () => {
    test.each([
        ["a non-empty string", "text"],
        ["an HTML string", "<b>text</b>"],
        ["a number", 42],
        ["zero", 0],
        ["an element", document.createElement("p")],
    ])("accepts %s", (_, value) => {
        expect(isDomRenderValue(value)).toBe(true);
    });

    test("accepts an element created in another realm", () => {
        const frame = document.createElement("iframe");

        document.body.append(frame);

        const element = frame.contentDocument!.createElement("p");

        expect(element instanceof Element).toBe(false);
        expect(isDomRenderValue(element)).toBe(true);

        frame.remove();
    });

    test.each([
        ["an empty string", ""],
        ["a boolean", true],
        ["null", null],
        ["undefined", undefined],
        ["a text node", document.createTextNode("text")],
        ["a plain object", {nodeType: "1"}],
    ])("rejects %s", (_, value) => {
        expect(isDomRenderValue(value)).toBe(false);
    });

    test("renders an HTML string as text", () => {
        const target = document.createElement("div");

        renderDomValue(target, "<b>text</b>");

        expect(target.children).toHaveLength(0);
        expect(target.textContent).toBe("<b>text</b>");
    });

    test("renders a number as text and appends an element", () => {
        const target = document.createElement("div");
        const element = document.createElement("p");

        renderDomValue(target, 0);

        expect(target.textContent).toBe("0");

        renderDomValue(target, element);

        expect(target.lastChild).toBe(element);
    });
});
