import {createTargetResolver} from "./target";
import type {ContentScriptTarget, ContentScriptTargetProps} from "@typing/content";

const props = (): ContentScriptTargetProps<{title: string}> => {
    const container = document.createElement("div");

    return {
        anchor: document.body,
        container,
        boundary: container.attachShadow({mode: "closed"}),
        document,
        data: {title: "Prepared"},
    };
};

describe("content target resolver", () => {
    test.each([
        [undefined, "DIV", ""],
        ["span", "SPAN", ""],
        [{tagName: "section", className: "panel"}, "SECTION", "panel"],
    ] as const)("creates an owned element from %j", (definition, tagName, className) => {
        const context = props();
        const target = createTargetResolver(definition)(context);

        expect(target.tagName).toBe(tagName);
        expect(target.className).toBe(className);
        expect(target.ownerDocument).toBe(document);
        expect(target.parentNode).toBeNull();
    });

    test("passes prepared data and isolation to the factory and resolves its returned description", () => {
        const context = props();
        const factory = jest.fn((input: typeof context) => ({tagName: "span" as const, title: input.data.title}));
        const target = createTargetResolver(factory)(context);

        expect(factory).toHaveBeenCalledWith(context);
        expect(target.getAttribute("title")).toBe("Prepared");
    });

    test("uses an iframe document for both descriptions and factory elements", () => {
        const frame = document.createElement("iframe");
        document.body.append(frame);

        try {
            const context = {...props(), boundary: frame, document: frame.contentDocument!};
            const factory = createTargetResolver(({document}) => document.createElement("span"));

            expect(createTargetResolver("section")(context).ownerDocument).toBe(frame.contentDocument);
            expect(factory(context).ownerDocument).toBe(frame.contentDocument);

            expect(() => createTargetResolver(() => document.createElement("span"))(context)).toThrow(
                /supplied document|valid element/
            );
        } finally {
            frame.remove();
        }
    });

    test("rejects asynchronous factories at runtime", () => {
        const factory = (() => Promise.resolve(document.createElement("span"))) as unknown as ContentScriptTarget;

        expect(() => createTargetResolver(factory)(props())).toThrow(/must return synchronously/);
    });

    test.each([undefined, null, 1, false, {}, {nodeType: 1}])(
        "rejects invalid JavaScript factory results %j",
        result => {
            const factory = (() => result) as unknown as ContentScriptTarget;

            expect(() => createTargetResolver(factory)(props())).toThrow(/valid element/);
        }
    );

    test("does not move page-owned elements or reuse the container as its own target", () => {
        const context = props();
        const element = document.createElement("section");
        document.body.append(element);

        try {
            expect(() => createTargetResolver(() => element)(context)).toThrow(/detached element/);
            expect(() => createTargetResolver(() => context.container)(context)).toThrow(/distinct/);
            expect(element.parentNode).toBe(document.body);
        } finally {
            element.remove();
        }
    });
});
