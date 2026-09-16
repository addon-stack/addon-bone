import MountBuilder from "./MountBuilder";
import {resolveDefinition} from "../resolvers/definition";
import {defineContentScript} from "@main/content";
import {
    ContentScriptEvent,
    ContentScriptIsolation,
    ContentScriptMarker,
    type ContentScriptDefinition,
} from "@typing/content";

// Extend the shared random-ID mock for the builders' generated marker attribute.
jest.mock("nanoid", () => ({
    nanoid: jest.fn(() => "mocked-id"),
    customAlphabet: () => () => "contentmarker",
}));

describe("MountBuilder", () => {
    afterEach(() => document.body.replaceChildren());

    test("Common runtime runs main without resolving a marker, creating nodes or starting a DOM watcher", async () => {
        const main = jest.fn();
        const marker = jest.fn(() => ContentScriptMarker.Weak);
        const anchor = jest.fn(() => document.body);
        const container = jest.fn(() => document.createElement("section"));
        const watch = jest.fn(() => jest.fn());
        const builder = new MountBuilder(resolveDefinition({default: {main, marker, anchor, container, watch}}));

        try {
            await builder.build();

            expect(main).toHaveBeenCalledWith(
                builder.getContext(),
                expect.objectContaining({
                    isolation: {type: ContentScriptIsolation.None},
                })
            );

            expect(main).toHaveBeenCalledTimes(1);
            expect(marker).not.toHaveBeenCalled();
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

    test("awaits main before resolving the marker and resolves the marker before processing anchors", async () => {
        const mainStarted = Promise.withResolvers<void>();
        const mainReady = Promise.withResolvers<void>();
        const markerStarted = Promise.withResolvers<void>();
        const markerReady = Promise.withResolvers<ContentScriptMarker>();
        const events: ContentScriptEvent[] = [];
        const anchor = jest.fn(() => document.body);
        const watch = jest.fn(() => () => {});

        const marker = jest.fn(() => {
            markerStarted.resolve();

            return markerReady.promise;
        });

        const builder = new MountBuilder(
            defineContentScript({
                anchor,
                marker,
                watch,
                render: true,

                main: async context => {
                    context.watch(event => events.push(event));
                    mainStarted.resolve();
                    await mainReady.promise;
                },
            })
        );

        const building = builder.build();

        try {
            await mainStarted.promise;
            expect(marker).not.toHaveBeenCalled();
            mainReady.resolve();
            await markerStarted.promise;
            expect(anchor).not.toHaveBeenCalled();
            expect(watch).not.toHaveBeenCalled();
            markerReady.resolve(ContentScriptMarker.Weak);
            await building;
            expect(anchor).toHaveBeenCalledTimes(1);
            expect(watch).toHaveBeenCalledTimes(1);
            expect(events).toEqual([ContentScriptEvent.Add]);
        } finally {
            mainReady.resolve();
            markerReady.resolve(ContentScriptMarker.Weak);
            await building;
            await builder.destroy();
        }
    });

    test.each(["main", "marker"])("does not continue initialization after destroy during %s", async stage => {
        const started = Promise.withResolvers<void>();
        const released = Promise.withResolvers<void>();
        const anchor = jest.fn(() => document.body);
        const prepare = jest.fn();
        const watch = jest.fn(() => () => {});

        const main = jest.fn(async () => {
            if (stage === "main") {
                started.resolve();
                await released.promise;
            }
        });

        const marker = jest.fn(async () => {
            if (stage === "marker") {
                started.resolve();
                await released.promise;
            }

            return ContentScriptMarker.Weak;
        });

        const builder = new MountBuilder(defineContentScript({main, marker, anchor, prepare, watch}));
        const building = builder.build();

        try {
            await started.promise;
            await builder.destroy();
            released.resolve();
            await building;
            expect(main).toHaveBeenCalledTimes(1);
            expect(marker).toHaveBeenCalledTimes(stage === "main" ? 0 : 1);
            expect(anchor).not.toHaveBeenCalled();
            expect(prepare).not.toHaveBeenCalled();
            expect(watch).not.toHaveBeenCalled();
            expect(builder.getContext().nodes.size).toBe(0);
        } finally {
            released.resolve();
            await building;
            await builder.destroy();
        }
    });

    test("rejects marker initialization after main has run without starting anchor processing", async () => {
        const error = new Error("Marker initialization failed");
        const main = jest.fn();
        const anchor = jest.fn(() => document.body);
        const watch = jest.fn(() => () => {});

        const marker = jest.fn(async () => {
            throw error;
        });

        const builder = new MountBuilder(defineContentScript({main, marker, anchor, watch, render: true}));

        try {
            await expect(builder.build()).rejects.toBe(error);
            expect(main).toHaveBeenCalledTimes(1);
            expect(marker).toHaveBeenCalledTimes(1);
            expect(anchor).not.toHaveBeenCalled();
            expect(watch).not.toHaveBeenCalled();
        } finally {
            await builder.destroy();
        }
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
                            src: node.boundary && "src" in node.boundary ? node.boundary.src : undefined,
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
            expect(context.mount()).toBeUndefined();
            context.unmount();
            expect(anchor.childElementCount).toBe(0);
            expect(context.mount()).toBeUndefined();
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

    test.each([{page: "panel"}, {src: "https://example.com/panel"}])(
        "prepare false tracks the anchor without embedding %p",
        async navigation => {
            const anchor = document.createElement("article");
            document.body.append(anchor);
            const prepare = jest.fn(async () => false as const);
            const container = jest.fn(() => document.createElement("section"));
            const mount = jest.fn();
            const boundary = jest.fn();

            const builder = new MountBuilder(
                defineContentScript({
                    anchor,
                    isolation: {type: "iframe", ...navigation},
                    prepare,
                    container,
                    mount,
                    boundary,
                })
            );

            try {
                await builder.build();
                const context = builder.getContext();
                expect(context.nodes.size).toBe(1);
                const [node] = context.nodes;
                expect(node.anchor).toBe(anchor);
                expect(node.container).toBeUndefined();
                expect(node.target).toBeUndefined();
                context.unmount();
                context.mount();
                expect(prepare).toHaveBeenCalledTimes(1);
                expect(container).not.toHaveBeenCalled();
                expect(mount).not.toHaveBeenCalled();
                expect(boundary).not.toHaveBeenCalled();
                expect(anchor.childElementCount).toBe(0);
            } finally {
                await builder.destroy();
            }
        }
    );

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

    test.each([undefined, "none", {type: "iframe", src: "https://example.com"}])(
        "rejects JavaScript target configuration without local isolation: %p",
        isolation => {
            const target = jest.fn();
            const definition = resolveDefinition({default: {isolation, target}});

            expect(() => new MountBuilder(definition)).toThrow(
                "target requires Shadow DOM or an iframe with local rendering"
            );
            expect(target).not.toHaveBeenCalled();
        }
    );

    test("Common runtime keeps the configuration accepted by the root define helper", () => {
        const options: ContentScriptDefinition<undefined, "iframe"> = defineContentScript({
            isolation: {type: "iframe", src: "https://example.com"},
        });

        expect(() => new MountBuilder(resolveDefinition({default: options}))).not.toThrow();
    });
});

test.each(["none", "shadow", "iframe"] as const)(
    "headless true never creates %s UI in the common runtime",
    async isolation => {
        const container = jest.fn(() => document.createElement("section"));

        const builder = new MountBuilder(
            defineContentScript({anchor: document.body, isolation, render: true, container})
        );

        try {
            await builder.build();
            const [node] = builder.getContext().nodes;
            expect(node.anchor).toBe(document.body);
            expect(node.container).toBeUndefined();
            expect(node.target).toBeUndefined();
            expect(container).not.toHaveBeenCalled();
        } finally {
            await builder.destroy();
        }
    }
);

test.each([undefined, "none", {type: "none"}])("rejects boundary setup without isolation %p", isolation => {
    const boundary = jest.fn();

    expect(() => new MountBuilder(resolveDefinition({default: {isolation, boundary}}))).toThrow(
        "boundary requires Shadow DOM or an iframe"
    );
    expect(boundary).not.toHaveBeenCalled();
});

test("rejects an invalid JavaScript boundary option without invoking it", () => {
    expect(() => new MountBuilder(resolveDefinition({default: {isolation: "iframe", boundary: {height: 20}}}))).toThrow(
        "boundary must be a synchronous setup handler"
    );
});

test("rejects asynchronous boundary setup and removes a partially created iframe", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    const builder = new MountBuilder(
        resolveDefinition({
            default: {
                anchor: document.body,
                isolation: {type: "iframe", src: "https://example.com"},
                boundary: async () => {},
            },
        })
    );

    try {
        await builder.build();
        expect(document.querySelector("iframe")).toBeNull();
        expect(builder.getContext().nodes.size).toBe(0);
        const error = logged.mock.calls[0][0] as AggregateError;
        expect(error.errors[0].message).toMatch(/boundary must return synchronously/);
    } finally {
        await builder.destroy();
        logged.mockRestore();
    }
});

test.each(["shadow", "iframe"] as const)("headless %s never invokes boundary setup", async isolation => {
    const boundary = jest.fn();
    const builder =
        isolation === "shadow"
            ? new MountBuilder(
                  defineContentScript({anchor: document.body, isolation: "shadow", render: true, boundary})
              )
            : new MountBuilder(
                  defineContentScript({anchor: document.body, isolation: "iframe", render: true, boundary})
              );

    try {
        await builder.build();
        builder.getContext().unmount();
        builder.getContext().mount();
        expect(boundary).not.toHaveBeenCalled();
        expect([...builder.getContext().nodes][0].boundary).toBeUndefined();
    } finally {
        await builder.destroy();
    }
});
