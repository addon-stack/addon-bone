import Builder from "./Builder";
import {resolveDefinition} from "./resolvers/definition";
import {defineContentScript, defineContentScriptAppend} from "@main/content";
import {ContentScriptEvent, type ContentScriptProps} from "@typing/content";

// Extend the shared random-ID mock for the builders' generated marker attribute.
jest.mock("nanoid", () => ({
    nanoid: jest.fn(() => "mocked-id"),
    customAlphabet: () => () => "contentmarker",
}));

describe("Vanilla Builder", () => {
    afterEach(() => document.body.replaceChildren());

    test("Vanilla awaits a default handler and preserves props, placement and cleanup", async () => {
        const anchor = document.createElement("article");
        document.body.appendChild(anchor);
        const render = jest.fn(async ({anchor: target}: ContentScriptProps) => {
            await Promise.resolve();
            const element = document.createElement("span");
            element.textContent = target.tagName;
            return element;
        });
        const unwatch = jest.fn();
        const events: {event: ContentScriptEvent; text: string | null | undefined}[] = [];
        const options = defineContentScriptAppend({
            anchor,
            watch: () => unwatch,
            main: context => {
                context.watch((event, node) => events.push({event, text: node.target?.textContent}));
            },
        });
        const definition = resolveDefinition({...options, default: render});
        expect(definition.render).toBe(render);
        expect(render).not.toHaveBeenCalled();
        const builder = new Builder(definition);

        try {
            await builder.build();
            expect(render).toHaveBeenCalledTimes(1);
            expect(render).toHaveBeenCalledWith(expect.objectContaining({anchor}));
            expect(anchor.querySelector("span")?.textContent).toBe("ARTICLE");
            expect(builder.getContext().nodes.size).toBe(1);
        } finally {
            await builder.destroy();
        }
        expect(anchor.childElementCount).toBe(0);
        expect(unwatch).toHaveBeenCalledTimes(1);
        expect(events).toEqual([
            {event: ContentScriptEvent.Add, text: ""},
            {event: ContentScriptEvent.Mount, text: "ARTICLE"},
            {event: ContentScriptEvent.Unmount, text: undefined},
            {event: ContentScriptEvent.Remove, text: undefined},
        ]);
    });

    test.each(["text", 0, 12])("Vanilla preserves the default render value %p", async value => {
        const anchor = document.createElement("article");
        document.body.appendChild(anchor);
        const builder = new Builder(resolveDefinition({anchor, default: value}));
        try {
            await builder.build();
            expect(anchor.textContent).toBe(String(value));
        } finally {
            await builder.destroy();
        }
    });

    test("Vanilla preserves the true result used to mark an anchor without a container", async () => {
        const anchor = document.createElement("article");
        document.body.appendChild(anchor);
        const container = jest.fn(() => document.createElement("section"));
        const builder = new Builder(defineContentScript({anchor, render: () => true, container}));
        try {
            await builder.build();
            expect(container).not.toHaveBeenCalled();
            expect(builder.getContext().nodes.size).toBe(1);
            expect(anchor.childElementCount).toBe(0);
        } finally {
            await builder.destroy();
        }
    });
});
