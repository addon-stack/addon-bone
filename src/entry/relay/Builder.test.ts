import Builder from "./Builder";
import VanillaBuilder from "../content/adapters/vanilla/Builder";
import MountBuilder from "../content/lifecycle/MountBuilder";
import RelayManager from "@relay/RelayManager";
import {isRelayContext} from "@relay/utils";
import {RelayAllFrames, RelayMethod, type RelayOptions} from "@typing/relay";
import type {ContentScriptDefinition} from "@typing/content";

// Extend the shared random-ID mock for content marker attributes.
jest.mock("nanoid", () => ({nanoid: jest.fn(() => "mocked-id"), customAlphabet: () => () => "relaymarker"}));

describe("Relay Builder", () => {
    const manager = RelayManager.getInstance();

    beforeEach(() => {
        // The shared harness mocks context detection; exercise its actual predicate here.
        jest.mocked(isRelayContext).mockImplementation(
            jest.requireActual<typeof import("@relay/utils")>("@relay/utils").isRelayContext
        );
        manager.clear();
    });

    afterEach(() => {
        manager.clear();
        document.body.replaceChildren();
    });

    test.each([undefined, false, true, RelayAllFrames.Any, RelayAllFrames.All])(
        "separates content options while keeping the Relay allFrames mode %p",
        async allFrames => {
            const received: ContentScriptDefinition[] = [];
            class ContentBuilder extends VanillaBuilder {
                constructor(definition: ContentScriptDefinition) {
                    super(definition);
                    received.push(definition);
                }
            }
            const instance = {ready: true};
            const init = jest.fn((_options: RelayOptions) => instance);
            const main = jest.fn();
            const render = () => true as const;
            const watch = () => () => {};
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
                    isolation: "none",
                },
                ContentBuilder
            );

            expect(received).toEqual([
                {
                    anchor: document.body,
                    render,
                    watch,
                    isolation: "none",
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
                    isolation: "none",
                });
                expect(main).toHaveBeenCalledTimes(1);
                expect(main).toHaveBeenCalledWith(
                    instance,
                    expect.any(Object),
                    expect.objectContaining({
                        name: "options",
                        init,
                        main,
                        method: RelayMethod.Scripting,
                        allFrames,
                        isolation: {type: "none"},
                    })
                );
            } finally {
                await builder.destroy();
            }
        }
    );

    test("registers transport before content rendering and waits for content and main", async () => {
        const events: string[] = [];
        let releaseRender!: () => void;
        let releaseMain!: () => void;
        let renderStarted!: () => void;
        let mainStarted!: () => void;
        const renderGate = new Promise<void>(resolve => {
            releaseRender = resolve;
        });
        const mainGate = new Promise<void>(resolve => {
            releaseMain = resolve;
        });
        const rendering = new Promise<void>(resolve => {
            renderStarted = resolve;
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
                render: async () => {
                    events.push("render");
                    expect(manager.get("ordered")).toBe(instance);
                    renderStarted();
                    await renderGate;
                    return "rendered";
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
            await rendering;
            expect(events).toEqual(["init", "render"]);
            expect(main).not.toHaveBeenCalled();
            releaseRender();
            await runningMain;
            expect(events).toEqual(["init", "render", "main"]);
            expect(completed).toBe(false);
            releaseMain();
            await building;
            expect(events).toEqual(["init", "render", "main", "main-ready"]);
            expect(completed).toBe(true);
        } finally {
            releaseRender();
            releaseMain();
            await building;
            await builder.destroy();
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
                width: "100%",
                height: 150,
            });
        } finally {
            await builder.destroy();
        }
        expect(document.querySelector("iframe")).toBeNull();
    });
});
