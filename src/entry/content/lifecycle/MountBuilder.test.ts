import MountBuilder from "./MountBuilder";
import {resolveDefinition} from "../resolvers/definition";
import {defineContentScript} from "@main/content";
import {ContentScriptEvent, ContentScriptIsolation, type ContentScriptDefinition} from "@typing/content";

// Extend the shared random-ID mock for the builders' generated marker attribute.
jest.mock("nanoid", () => ({
    nanoid: jest.fn(() => "mocked-id"),
    customAlphabet: () => () => "contentmarker",
}));

describe("MountBuilder", () => {
    afterEach(() => document.body.replaceChildren());

    test("Common runtime runs main without creating nodes or starting a DOM watcher", async () => {
        const main = jest.fn();
        const anchor = jest.fn(() => document.body);
        const container = jest.fn(() => document.createElement("section"));
        const watch = jest.fn(() => jest.fn());
        const builder = new MountBuilder(resolveDefinition({default: {main, anchor, container, watch}}));

        try {
            await builder.build();
            expect(main).toHaveBeenCalledWith(
                builder.getContext(),
                expect.objectContaining({
                    isolation: {type: ContentScriptIsolation.None},
                })
            );
            expect(main).toHaveBeenCalledTimes(1);
            expect(anchor).not.toHaveBeenCalled();
            expect(container).not.toHaveBeenCalled();
            expect(watch).not.toHaveBeenCalled();
            expect(builder.getContext().nodes.size).toBe(0);
        } finally {
            await builder.destroy();
        }
    });

    test.each(["named", "default"])("Common runtime rejects a %s render handler without calling it", exported => {
        const render = jest.fn();
        const definition = resolveDefinition(exported === "named" ? {render} : {default: render});

        expect(() => new MountBuilder(definition)).toThrow("Content script rendering requires a renderer adapter");
        expect(render).not.toHaveBeenCalled();
    });

    test("Common runtime mounts, remounts and cleans up navigation with lifecycle events", async () => {
        const anchor = document.createElement("article");
        document.body.appendChild(anchor);
        const events: {event: ContentScriptEvent; connected: boolean; src?: string}[] = [];
        const unwatch = jest.fn();
        const cleanupMount = jest.fn();
        const src = "https://example.com/panel";
        const builder = new MountBuilder(
            defineContentScript({
                anchor,
                isolation: {type: "iframe", src},
                watch: () => unwatch,
                mount: (target, container) => {
                    target.append(container);
                    return cleanupMount;
                },
                main: context => {
                    context.watch((event, node) => {
                        events.push({
                            event,
                            connected: !!node.container?.isConnected,
                            src: node.container?.querySelector("iframe")?.src,
                        });
                    });
                },
            })
        );

        try {
            await builder.build();
            expect(anchor.querySelector("iframe")?.src).toBe(src);
            const context = builder.getContext();
            expect(context.nodes.size).toBe(1);
            context.mount();
            context.unmount();
            expect(anchor.childElementCount).toBe(0);
            context.mount();
            expect(anchor.querySelector("iframe")?.src).toBe(src);
            expect(context.nodes.size).toBe(1);
        } finally {
            await builder.destroy();
        }

        expect(events).toEqual([
            {event: ContentScriptEvent.Add, connected: false, src: undefined},
            {event: ContentScriptEvent.Mount, connected: true, src},
            {event: ContentScriptEvent.Unmount, connected: false, src: undefined},
            {event: ContentScriptEvent.Mount, connected: true, src},
            {event: ContentScriptEvent.Unmount, connected: false, src: undefined},
            {event: ContentScriptEvent.Remove, connected: false, src: undefined},
        ]);
        expect(anchor.childElementCount).toBe(0);
        expect(builder.getContext().nodes.size).toBe(0);
        expect(cleanupMount).toHaveBeenCalledTimes(2);
        expect(unwatch).toHaveBeenCalledTimes(1);
    });

    test.each([undefined, () => "forbidden"])("Common runtime rejects an explicit render property: %p", render => {
        const definition = resolveDefinition({
            default: {isolation: {type: "iframe", src: "https://example.com"}, render},
        });
        expect(() => new MountBuilder(definition)).toThrow(
            "isolation.page/isolation.src cannot be combined with render"
        );
    });

    test("Common runtime rejects a default function without calling it", () => {
        const render = jest.fn();
        const definition = resolveDefinition({
            isolation: {type: "iframe", src: "https://example.com"},
            default: render,
        });
        expect(() => new MountBuilder(definition)).toThrow(
            "isolation.page/isolation.src cannot be combined with render"
        );
        expect(render).not.toHaveBeenCalled();
    });

    test("Common runtime keeps the configuration accepted by the root define helper", () => {
        const options: ContentScriptDefinition = defineContentScript({
            isolation: {type: "iframe", src: "https://example.com"},
        });
        expect(() => new MountBuilder(resolveDefinition({default: options}))).not.toThrow();
    });
});
