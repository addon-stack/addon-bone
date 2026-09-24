import Builder from "./Builder";
import VanillaBuilder from "../content/adapters/vanilla/Builder";
import MountBuilder from "../content/lifecycle/MountBuilder";
import RelayManager from "@relay/RelayManager";
import {RelayAllFrames, RelayMethod, type RelayOptions} from "@typing/relay";
import type {ContentScriptDefinition} from "@typing/content";

// Keep content marker IDs deterministic for lifecycle assertions.
jest.mock("nanoid", () => ({nanoid: jest.fn(() => "mocked-id"), customAlphabet: () => () => "relaymarker"}));

describe("Relay Builder", () => {
    let manager: ReturnType<typeof RelayManager.getInstance>;

    beforeEach(() => {
        manager = RelayManager.getInstance();
    });

    afterEach(() => {
        manager.clear();
        document.body.replaceChildren();
    });

    test.each([undefined, false, true, RelayAllFrames.Any, RelayAllFrames.All])(
        "separates content options while keeping the Relay allFrames mode %p",
        async allFrames => {
            const received: ContentScriptDefinition<unknown, "shadow">[] = [];

            class ContentBuilder extends VanillaBuilder<unknown, "shadow"> {
                constructor(definition: ContentScriptDefinition<unknown, "shadow">) {
                    super(definition);
                    received.push(definition);
                }
            }

            const instance = {ready: true};
            const init = jest.fn((_options: RelayOptions) => instance);
            const main = jest.fn();
            const render = true as const;
            const watch = () => () => {};
            const target = jest.fn(() => "span" as const);
            const boundary = jest.fn();

            const builder = new Builder(
                {
                    name: "options",
                    init,
                    main,
                    method: RelayMethod.Scripting,
                    allFrames,
                    anchor: document.body,
                    render,
                    watch,
                    isolation: "shadow",
                    target,
                    boundary,
                },
                ContentBuilder
            );

            expect(received).toEqual([
                {
                    anchor: document.body,
                    render,
                    watch,
                    isolation: "shadow",
                    target,
                    boundary,
                    ...(allFrames === undefined ? {} : {allFrames: allFrames !== false}),
                },
            ]);

            expect(init).not.toHaveBeenCalled();

            try {
                await builder.build();
                expect(init).toHaveBeenCalledTimes(1);

                expect(init.mock.calls[0][0]).toEqual({
                    name: "options",
                    allFrames,
                    anchor: document.body,
                    render,
                    watch,
                    isolation: "shadow",
                });

                expect(main).toHaveBeenCalledTimes(1);
                expect(main.mock.calls[0][2]).not.toHaveProperty("target");
                expect(main.mock.calls[0][2]).not.toHaveProperty("boundary");
                expect(init.mock.calls[0][0]).not.toHaveProperty("boundary");
                expect(boundary).not.toHaveBeenCalled();
                expect(target).not.toHaveBeenCalled();

                expect(main).toHaveBeenCalledWith(
                    instance,
                    expect.any(Object),
                    expect.objectContaining({
                        name: "options",
                        init,
                        main,
                        method: RelayMethod.Scripting,
                        allFrames,
                        isolation: {type: "shadow", mode: "open"},
                    })
                );
            } finally {
                await builder.destroy();
            }
        }
    );

    test("registers transport before preparation, then mounts content before main", async () => {
        const events: string[] = [];
        let releasePrepare!: () => void;
        let releaseMain!: () => void;
        let prepareStarted!: () => void;
        let mainStarted!: () => void;

        const prepareGate = new Promise<void>(resolve => {
            releasePrepare = resolve;
        });

        const mainGate = new Promise<void>(resolve => {
            releaseMain = resolve;
        });

        const preparing = new Promise<void>(resolve => {
            prepareStarted = resolve;
        });

        const runningMain = new Promise<void>(resolve => {
            mainStarted = resolve;
        });

        const instance = {ready: true};

        const main = jest.fn(async (relay, context) => {
            events.push("main");
            expect(relay).toBe(instance);
            expect(context.nodes.size).toBe(1);
            expect(document.body.textContent).toBe("rendered");
            mainStarted();
            await mainGate;
            events.push("main-ready");
        });

        const builder = new Builder(
            {
                name: "ordered",
                method: RelayMethod.Scripting,

                init: () => {
                    events.push("init");

                    return instance;
                },

                prepare: async () => {
                    events.push("prepare");
                    expect(manager.get("ordered")).toBe(instance);
                    prepareStarted();
                    await prepareGate;

                    return {text: "rendered"};
                },

                render: ({data}) => {
                    events.push("render");

                    return data.text;
                },

                watch: () => () => {},
                main,
            },
            VanillaBuilder
        );

        let completed = false;

        const building = builder.build().then(() => {
            completed = true;
        });

        try {
            await preparing;
            expect(events).toEqual(["init", "prepare"]);
            expect(document.body.childElementCount).toBe(0);
            expect(main).not.toHaveBeenCalled();
            releasePrepare();
            await runningMain;
            expect(events).toEqual(["init", "prepare", "render", "main"]);
            expect(completed).toBe(false);
            releaseMain();
            await building;
            expect(events).toEqual(["init", "prepare", "render", "main", "main-ready"]);
            expect(completed).toBe(true);
        } finally {
            releasePrepare();
            releaseMain();
            await building;
            await builder.destroy();
        }
    });

    test("runs main with the registered transport after an anchor preparation fails", async () => {
        const error = new Error("Preparation failed");
        const report = jest.spyOn(console, "error").mockImplementation(() => {});
        const instance = {ready: true};
        const main = jest.fn();
        const watch = jest.fn(() => () => {});

        const builder = new Builder(
            {
                name: "prepare-failure",
                method: RelayMethod.Scripting,
                init: () => instance,

                prepare: async () => {
                    expect(manager.get("prepare-failure")).toBe(instance);

                    throw error;
                },

                render: true,
                watch,
                main,
            },
            VanillaBuilder
        );

        try {
            await expect(builder.build()).resolves.toBeUndefined();
            expect(report).toHaveBeenCalledTimes(1);
            expect(report).toHaveBeenCalledWith(expect.any(AggregateError));
            expect(report.mock.calls[0][0].errors).toEqual([error]);
            expect(watch).toHaveBeenCalledTimes(1);
            expect(main).toHaveBeenCalledTimes(1);
            const [relay, context] = main.mock.calls[0];
            expect(relay).toBe(instance);
            expect(context.nodes.size).toBe(0);
            expect(manager.get("prepare-failure")).toBe(instance);
        } finally {
            await builder.destroy();
            report.mockRestore();
        }
    });

    test.each([RelayMethod.Messaging, RelayMethod.Scripting])(
        "rebuilds and cleans up the %s transport before its content",
        async method => {
            const instances: {generation: number}[] = [];

            const cleanup = jest.fn(() => {
                expect(manager.has("rebuild")).toBe(false);
            });

            const unwatch = jest.fn(() => {
                expect(manager.has("rebuild")).toBe(false);
            });

            const main = jest.fn();

            const builder = new Builder(
                {
                    name: "rebuild",
                    method,

                    init: () => {
                        const instance = {generation: instances.length + 1};
                        instances.push(instance);

                        return instance;
                    },

                    render: () => String(manager.get("rebuild").generation),

                    mount: (anchor, container) => {
                        anchor.append(container);

                        return cleanup;
                    },

                    watch: () => unwatch,
                    main,
                },
                VanillaBuilder
            );

            try {
                await builder.build();
                expect(document.body.textContent).toBe("1");
                await builder.build();
                expect(document.body.textContent).toBe("2");
                expect(manager.get("rebuild")).toBe(instances[1]);
                expect(main).toHaveBeenCalledTimes(2);
                expect(main.mock.calls[0][0]).toBe(instances[0]);
                expect(main.mock.calls[1][0]).toBe(instances[1]);
                expect(cleanup).toHaveBeenCalledTimes(1);
                expect(unwatch).toHaveBeenCalledTimes(1);
            } finally {
                await builder.destroy();
            }

            expect(manager.has("rebuild")).toBe(false);
            expect(document.body.childElementCount).toBe(0);
            expect(cleanup).toHaveBeenCalledTimes(2);
            expect(unwatch).toHaveBeenCalledTimes(2);
            await builder.destroy();
            expect(cleanup).toHaveBeenCalledTimes(2);
            expect(unwatch).toHaveBeenCalledTimes(2);
        }
    );

    test("uses the common content builder for iframe navigation", async () => {
        const main = jest.fn();

        const builder = new Builder(
            {
                name: "navigation",
                method: RelayMethod.Scripting,
                init: () => ({ready: true}),
                main,
                isolation: {type: "iframe", src: "https://example.com/panel"},
                watch: () => () => {},
            },
            MountBuilder
        );

        try {
            await builder.build();
            expect(document.querySelector("iframe")?.src).toBe("https://example.com/panel");
            expect(main.mock.calls[0][1].nodes.size).toBe(1);

            expect(main.mock.calls[0][2].isolation).toEqual({
                type: "iframe",
                src: "https://example.com/panel",
            });
        } finally {
            await builder.destroy();
        }

        expect(document.querySelector("iframe")).toBeNull();
    });
});

test("Relay destruction invalidates pending preparation and prevents late main", async () => {
    const prepareStarted = Promise.withResolvers<void>();
    const response = Promise.withResolvers<string>();
    const main = jest.fn();
    const render = jest.fn(() => "UI");
    const init = jest.fn((_options: RelayOptions) => ({ready: true}));

    const builder = new Builder(
        {
            name: "pending",
            method: RelayMethod.Scripting,
            init,
            main,
            render,

            prepare: () => {
                prepareStarted.resolve();

                return response.promise;
            },
        },
        VanillaBuilder
    );

    const building = builder.build();

    try {
        await prepareStarted.promise;
        expect(init.mock.calls[0]?.[0]).not.toHaveProperty("prepare");
        await builder.destroy();
        response.resolve("late");
        await building;
        expect(main).not.toHaveBeenCalled();
        expect(render).not.toHaveBeenCalled();
    } finally {
        response.resolve("late");
        await building;
        await builder.destroy();
    }
});
