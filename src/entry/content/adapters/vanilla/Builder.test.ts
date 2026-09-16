import Builder from "./Builder";
import {waitFor} from "@testing-library/react";
import {resolveDefinition} from "./definition";
import {defineContentScript, defineContentScriptAppend} from "@main/content";
import {
    ContentScriptAppend,
    ContentScriptEvent,
    type ContentScriptProps,
    type ContentScriptBoundaryProps,
    type ContentScriptTargetProps,
    type ContentScriptMainFunction,
} from "@typing/content";

// Extend the shared random-ID mock for the builders' generated marker attribute.
jest.mock("nanoid", () => ({
    nanoid: jest.fn(() => "mocked-id"),
    customAlphabet: () => () => "contentmarker",
}));

jest.mock("../../lifecycle/nodes/isolated-styles", () => ({
    getContentScriptStylesRuntime: () => ({add: jest.fn(), ready: jest.fn(async () => undefined), delete: jest.fn()}),
}));

describe("Vanilla Builder", () => {
    afterEach(() => document.body.replaceChildren());

    test("Vanilla invokes a default handler and preserves props, placement and cleanup", async () => {
        const anchor = document.createElement("article");
        document.body.appendChild(anchor);

        const render = jest.fn(({anchor: target}: ContentScriptProps) => {
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

    test.each(["shadow", "iframe"] as const)(
        "%s connects renderer failure handling before an Add listener can mount the node",
        async isolation => {
            const anchor = document.createElement("article");
            document.body.append(anchor);
            const error = new Error("Deferred renderer failed");
            const report = jest.spyOn(console, "error").mockImplementation(() => {});
            const events: ContentScriptEvent[] = [];
            const render = jest.fn(() => {
                throw error;
            });

            const builder = new Builder(
                defineContentScript({
                    anchor,
                    isolation,
                    render,
                    main: context => {
                        context.watch((event, node) => {
                            events.push(event);

                            if (event === ContentScriptEvent.Add) {
                                expect(node.mount()).toBe(false);
                            }
                        });
                    },
                })
            );

            try {
                await builder.build();
                await waitFor(() => expect(report).toHaveBeenCalledTimes(1));
                expect(report.mock.calls[0][0]).toBeInstanceOf(AggregateError);
                expect(report.mock.calls[0][0].errors).toEqual([error]);
                expect(render).toHaveBeenCalledTimes(1);
                expect(events.filter(event => event === ContentScriptEvent.Remove)).toHaveLength(1);
                expect(events).not.toContain(ContentScriptEvent.Mount);
                expect(builder.getContext().nodes.size).toBe(0);
                expect(anchor.childElementCount).toBe(0);
            } finally {
                await builder.destroy();
                report.mockRestore();
            }
        }
    );

    test("Vanilla preserves the literal true used to track an anchor without a container", async () => {
        const anchor = document.createElement("article");
        document.body.appendChild(anchor);
        const container = jest.fn(() => document.createElement("section"));
        const builder = new Builder(defineContentScript({anchor, render: true, container}));

        try {
            await builder.build();
            expect(container).not.toHaveBeenCalled();
            expect(builder.getContext().nodes.size).toBe(1);
            expect(anchor.childElementCount).toBe(0);
        } finally {
            await builder.destroy();
        }
    });

    test.each([false, null, undefined, ""])(
        "an empty render result %p releases UI without repeating rendering",
        async value => {
            const anchor = document.createElement("article");
            document.body.append(anchor);
            const container = jest.fn(() => document.createElement("section"));
            const render = jest.fn(() => value);
            const builder = new Builder(defineContentScript({anchor, container, render}));

            try {
                await builder.build();
                expect(container).toHaveBeenCalledTimes(1);
                expect(anchor.childElementCount).toBe(0);
                const [node] = builder.getContext().nodes;
                expect(node.anchor).toBe(anchor);
                expect(node.target).toBeUndefined();
                expect(node.mount()).toBe(false);
                expect(render).toHaveBeenCalledTimes(1);
                expect(anchor.childElementCount).toBe(0);
            } finally {
                await builder.destroy();
            }
        }
    );
});

describe("Vanilla preparation and render props", () => {
    afterEach(() => document.body.replaceChildren());

    const createAnchor = () => {
        const anchor = document.createElement("article");
        document.body.append(anchor);

        return anchor;
    };

    test("awaits per-anchor data before creating a container and refreshes props on remount", async () => {
        const anchor = createAnchor();
        const started = Promise.withResolvers<void>();
        const response = Promise.withResolvers<{title: string}>();

        const prepare = jest.fn(() => {
            started.resolve();

            return response.promise;
        });

        const calls: ContentScriptProps<{title: string}>[] = [];
        const events: ContentScriptEvent[] = [];

        const container = jest.fn(({data}) => {
            const element = document.createElement("section");
            element.title = data.title;

            return element;
        });

        const builder = new Builder(
            defineContentScript({
                anchor,
                prepare,

                main: context => {
                    context.watch(event => events.push(event));
                },

                container,

                render: props => {
                    calls.push(props);

                    return props.data.title;
                },
            })
        );

        const building = builder.build();

        try {
            await started.promise;
            expect(container).not.toHaveBeenCalled();
            expect(anchor.childElementCount).toBe(0);
            expect(calls).toHaveLength(0);
            response.resolve({title: "Prepared"});
            await building;
            const first = calls[0];
            expect(first.container).toBe(anchor.firstElementChild);
            expect(first.target).toBe(first.container);
            expect(first.isolation).toEqual({type: "none"});
            expect(first.data).toEqual({title: "Prepared"});
            expect(first).not.toHaveProperty("prepare");
            expect(builder.getContext().mount()).toBeUndefined();
            expect(calls).toHaveLength(1);
            events.length = 0;
            expect(builder.getContext().unmount()).toBeUndefined();
            expect(anchor.childElementCount).toBe(0);
            expect(events).toEqual([ContentScriptEvent.Unmount]);
            expect(builder.getContext().mount()).toBeUndefined();
            expect(events).toEqual([ContentScriptEvent.Unmount, ContentScriptEvent.Mount]);
            expect(calls).toHaveLength(2);
            expect(calls[1].container).not.toBe(first.container);
            expect(calls[1].target).toBe(calls[1].container);
            expect(calls[1].data).toBe(first.data);
            expect(prepare).toHaveBeenCalledTimes(1);
            expect(anchor.textContent).toBe("Prepared");
        } finally {
            response.resolve({title: "Prepared"});
            await building;
            await builder.destroy();
        }
    });

    test("creates a custom target with prepared data and exposes the same closed boundary throughout the lifecycle", async () => {
        const anchor = createAnchor();
        const data = {title: "Prepared"};
        const prepare = jest.fn(() => data);
        const calls: ContentScriptTargetProps<typeof data, "shadow">[] = [];
        const rendered: ContentScriptProps<typeof data, "shadow">[] = [];
        const boundaries: (ShadowRoot | HTMLIFrameElement | undefined)[] = [];

        const main = jest.fn<ReturnType<ContentScriptMainFunction>, Parameters<ContentScriptMainFunction>>(context => {
            context.watch((_event, node) => boundaries.push(node.boundary));
        });

        const builder = new Builder(
            defineContentScript({
                anchor,
                isolation: {type: "shadow", mode: "closed"},
                prepare,
                main,

                target: props => {
                    calls.push(props);
                    props.container.setAttribute("data-title", props.data.title);

                    return {tagName: "span", className: "custom-target"};
                },

                render: props => {
                    rendered.push(props);

                    return props.data.title;
                },
            })
        );

        try {
            await builder.build();
            const context = builder.getContext();
            const [node] = context.nodes;
            const first = calls[0];

            expect(first).toMatchObject({anchor, data, document, container: node.container, boundary: node.boundary});
            expect(first.boundary.host).toBe(first.container);
            expect(first.container.shadowRoot).toBeNull();
            expect(first.container.getAttribute("data-title")).toBe("Prepared");
            expect(first).not.toHaveProperty("target");
            expect(first).not.toHaveProperty("prepare");
            expect(main.mock.calls[0][1]).not.toHaveProperty("target");
            expect(rendered[0]).toMatchObject({boundary: first.boundary, target: node.target});
            expect(node.target?.outerHTML).toBe('<span class="custom-target">Prepared</span>');
            await waitFor(() => expect(boundaries).toHaveLength(2));
            expect(boundaries[0]).toBeUndefined();
            expect(boundaries[1]).toBe(first.boundary);
            context.mount();
            expect(calls).toHaveLength(1);
            context.unmount();
            expect(node.boundary).toBeUndefined();
            expect(boundaries.at(-1)).toBeUndefined();
            context.mount();
            expect(calls).toHaveLength(2);
            expect(calls[1].boundary).not.toBe(first.boundary);
            expect(calls[1].container).not.toBe(first.container);
            expect(calls[1].data).toBe(data);
            await waitFor(() => expect(rendered).toHaveLength(2));
            expect(rendered[1].boundary).toBe(node.boundary);
            expect(prepare).toHaveBeenCalledTimes(1);
        } finally {
            await builder.destroy();
        }
    });

    test.each(["headless", "disabled"])("%s never calls the target factory", async mode => {
        const anchor = createAnchor();
        const target = jest.fn(() => "span" as const);
        const builder = new Builder(
            defineContentScript({
                anchor,
                isolation: "shadow",
                target,
                prepare: () => (mode === "disabled" ? false : undefined),
                render: mode === "headless" ? true : () => "UI",
            })
        );

        try {
            await builder.build();
            const context = builder.getContext();
            const [node] = context.nodes;
            context.unmount();
            context.mount();
            expect(target).not.toHaveBeenCalled();
            expect(node.boundary).toBeUndefined();
            expect(node.target).toBeUndefined();
            expect(node.container).toBeUndefined();
            expect(anchor.childElementCount).toBe(0);
        } finally {
            await builder.destroy();
        }
    });

    test("false tracks anchors without UI or retries while other anchors receive their own data", async () => {
        const allowed = createAnchor();
        const denied = createAnchor();
        allowed.className = denied.className = "product";
        const prepare = jest.fn(async ({anchor}) => (anchor === allowed ? {title: "Allowed"} : false));
        const container = jest.fn(() => document.createElement("section"));
        const render = jest.fn(({data}) => data.title);
        const update = Promise.withResolvers<() => void>();

        const builder = new Builder(
            defineContentScript({
                anchor: ".product",
                prepare,
                render,
                container,

                watch: callback => {
                    update.resolve(callback);

                    return () => {};
                },
            })
        );

        try {
            await builder.build();
            (await update.promise)();
            expect(builder.getContext().mount()).toBeUndefined();
            expect(builder.getContext().nodes.size).toBe(2);
            expect(prepare).toHaveBeenCalledTimes(2);
            expect(container).toHaveBeenCalledTimes(1);
            expect(render).toHaveBeenCalledTimes(1);
            expect(allowed.textContent).toBe("Allowed");
            const node = [...builder.getContext().nodes].find(node => node.anchor === denied)!;
            expect(node.container).toBeUndefined();
            expect(node.target).toBeUndefined();
        } finally {
            await builder.destroy();
        }
    });

    test.each(["remove", "destroy", "rebuild"])("ignores a pending preparation after %s", async action => {
        const anchor = createAnchor();
        const started = Promise.withResolvers<void>();
        const response = Promise.withResolvers<string>();
        let calls = 0;
        const container = jest.fn(() => document.createElement("section"));
        const render = jest.fn(({data}) => data);
        const watch = jest.fn(() => () => {});

        const builder = new Builder(
            defineContentScript({
                anchor,
                container,
                render,
                watch,

                prepare: () => {
                    calls++;
                    started.resolve();

                    return calls === 1 ? response.promise : "new";
                },
            })
        );

        const building = builder.build();

        try {
            await started.promise;

            if (action === "remove") {
                anchor.remove();
            } else if (action === "destroy") {
                await builder.destroy();
            } else {
                await builder.build();
            }

            response.resolve("stale");
            await building;
            expect(render).toHaveBeenCalledTimes(action === "rebuild" ? 1 : 0);
            expect(container).toHaveBeenCalledTimes(action === "rebuild" ? 1 : 0);
            expect(anchor.textContent).toBe(action === "rebuild" ? "new" : "");
            expect(watch).toHaveBeenCalledTimes(action === "destroy" ? 0 : 1);
        } finally {
            response.resolve("stale");
            await building;
            await builder.destroy();
        }
    });

    test.each(["prepare", "container", "target", "render"])(
        "reports per-anchor %s errors and continues processing initial and watched anchors",
        async stage => {
            jest.useFakeTimers();
            const report = jest.spyOn(console, "error").mockImplementation(() => {});
            const error = new Error(`${stage} failed`);
            const failed = [createAnchor(), createAnchor()];
            const initial = createAnchor();
            const failures = new Set<Element>(failed);

            const builder = new Builder(
                defineContentScript({
                    anchor: "article",
                    isolation: "shadow",
                    watch: true,

                    prepare: async ({anchor}) => {
                        if (stage === "prepare" && failures.has(anchor)) {
                            throw error;
                        }

                        return "content";
                    },

                    container: ({anchor}) => {
                        if (stage === "container" && failures.has(anchor)) {
                            throw error;
                        }

                        return document.createElement("section");
                    },

                    target: ({anchor, document}) => {
                        if (stage === "target" && failures.has(anchor)) {
                            throw error;
                        }

                        return document.createElement("span");
                    },

                    render: ({anchor, data}) => {
                        if (stage === "render" && failures.has(anchor)) {
                            throw error;
                        }

                        return data;
                    },
                })
            );

            try {
                await expect(builder.build()).resolves.toBeUndefined();
                await waitFor(() => expect(report).toHaveBeenCalledTimes(stage === "render" ? 2 : 1));
                expect(report).toHaveBeenLastCalledWith(expect.any(AggregateError));
                expect(report.mock.calls.flatMap(([reported]) => reported.errors)).toEqual([error, error]);
                expect(builder.getContext().nodes.size).toBe(1);
                expect(initial.firstElementChild?.shadowRoot?.textContent).toBe("content");

                for (const anchor of failed) {
                    expect(anchor.childElementCount).toBe(0);
                    anchor.remove();
                }

                const rejected = createAnchor();
                failures.add(rejected);
                const next = createAnchor();
                await jest.advanceTimersByTimeAsync(201);
                expect(next.firstElementChild?.shadowRoot?.textContent).toBe("content");
                expect(rejected.childElementCount).toBe(0);
                expect(builder.getContext().nodes.size).toBe(2);
                expect(report).toHaveBeenCalledTimes(stage === "render" ? 3 : 2);
                expect(report).toHaveBeenLastCalledWith(expect.any(AggregateError));
                expect(report.mock.calls.at(-1)![0].errors).toEqual([error]);

                rejected.remove();
                const last = createAnchor();
                await jest.advanceTimersByTimeAsync(201);
                expect(last.firstElementChild?.shadowRoot?.textContent).toBe("content");
                expect(builder.getContext().nodes.size).toBe(3);
            } finally {
                await builder.destroy();
                report.mockRestore();
                jest.useRealTimers();
            }
        }
    );

    test.each(["remove", "unmount", "remount"])(
        "discards UI when a render callback synchronously triggers %s",
        async action => {
            const anchor = createAnchor();
            let calls = 0;
            const events: ContentScriptEvent[] = [];

            const builder = new Builder(
                defineContentScript({
                    anchor,

                    main: context => {
                        context.watch(event => events.push(event));
                    },

                    render: () => {
                        if (calls++ > 0) {
                            return "current";
                        }

                        if (action === "remove") {
                            anchor.remove();
                        } else {
                            builder.getContext().unmount();

                            if (action === "remount") {
                                builder.getContext().mount();
                            }
                        }

                        return "stale";
                    },
                })
            );

            try {
                await builder.build();
                expect(anchor.textContent).toBe(action === "remount" ? "current" : "");

                expect(events.filter(event => event === ContentScriptEvent.Mount)).toHaveLength(
                    action === "remount" ? 1 : 0
                );
            } finally {
                await builder.destroy();
            }
        }
    );
});

test("append replacement renders with prepared props even though mounting replaces the anchor", async () => {
    const anchor = document.createElement("article");
    document.body.append(anchor);

    const builder = new Builder(
        defineContentScriptAppend({
            anchor,
            append: ContentScriptAppend.Replace,
            prepare: async () => ({title: "replacement"}),
            render: ({data}) => data.title,
        })
    );

    try {
        await builder.build();
        expect(anchor.isConnected).toBe(false);
        expect(document.body.textContent).toBe("replacement");
    } finally {
        await builder.destroy();
        document.body.replaceChildren();
    }
});

test("remount propagates render errors synchronously and releases the failed UI", async () => {
    const anchor = document.createElement("article");
    document.body.append(anchor);
    const error = new Error("Cannot render");
    let calls = 0;
    const events: ContentScriptEvent[] = [];

    const builder = new Builder(
        defineContentScript({
            anchor,

            main: context => {
                context.watch(event => events.push(event));
            },

            render: () => {
                if (calls++ > 0) {
                    throw error;
                }

                return "content";
            },
        })
    );

    try {
        await builder.build();
        builder.getContext().unmount();
        events.length = 0;
        expect(() => builder.getContext().mount()).toThrow(error);
        expect(anchor.childElementCount).toBe(0);
        expect([...builder.getContext().nodes][0].target).toBeUndefined();
        expect(events).not.toContain(ContentScriptEvent.Mount);
    } finally {
        await builder.destroy();
        anchor.remove();
    }
});

test("does not mount a container whose async factory finishes after its anchor was removed", async () => {
    const anchor = document.createElement("article");
    document.body.append(anchor);
    const started = Promise.withResolvers<void>();
    const response = Promise.withResolvers<Element>();
    const render = jest.fn(() => "UI");
    const mount = jest.fn();

    const builder = new Builder(
        defineContentScript({
            anchor,
            mount,
            render,

            container: () => {
                started.resolve();

                return response.promise;
            },
        })
    );

    const building = builder.build();

    try {
        await started.promise;
        anchor.remove();
        response.resolve(document.createElement("section"));
        await building;
        expect(mount).not.toHaveBeenCalled();
        expect(render).not.toHaveBeenCalled();
        expect(builder.getContext().nodes.size).toBe(0);
    } finally {
        response.resolve(document.createElement("section"));
        await building;
        await builder.destroy();
    }
});

test("simultaneous builds prepare each anchor only in the latest lifecycle", async () => {
    const anchor = document.createElement("article");
    document.body.append(anchor);
    const prepare = jest.fn(async () => ({title: "latest"}));
    const builder = new Builder(defineContentScript({anchor, prepare, render: ({data}) => data.title}));

    try {
        await Promise.all([builder.build(), builder.build()]);
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(builder.getContext().nodes.size).toBe(1);
        expect(anchor.textContent).toBe("latest");
    } finally {
        await builder.destroy();
        anchor.remove();
    }
});

test.each(["shadow", "iframe"] as const)(
    "boundary cleanup cannot remount an old %s renderer or stop other cleanups",
    async isolation => {
        const anchors = [document.createElement("article"), document.createElement("article")];
        anchors.forEach(anchor => anchor.classList.add("boundary-test"));
        document.body.append(...anchors);
        const cleanup = jest.fn();
        const render = jest.fn(() => "Panel");
        const error = new Error("Cleanup failed");
        const logged = jest.spyOn(console, "error").mockImplementation(() => {});
        const options = {
            anchor: ".boundary-test",
            prepare: (props: {anchor: Element}) => ({label: props.anchor.tagName}),
            boundary: (props: ContentScriptBoundaryProps<{label: string}>) => {
                expect(props.data.label).toBe("ARTICLE");
                expect(props.container.isConnected).toBe(true);
                expect(props).not.toHaveProperty("target");
                expect(props).not.toHaveProperty("document");
                expect(props).not.toHaveProperty("prepare");

                return () => {
                    cleanup();
                    builder.getContext().mount();
                    throw error;
                };
            },
            render,
        };

        const builder =
            isolation === "shadow"
                ? new Builder(defineContentScript({...options, isolation: "shadow"}))
                : new Builder(defineContentScript({...options, isolation: "iframe"}));

        try {
            await builder.build();
            expect(render).toHaveBeenCalledTimes(2);
            builder.getContext().unmount();
            expect(cleanup).toHaveBeenCalledTimes(2);
            expect(render).toHaveBeenCalledTimes(2);
            expect(logged).toHaveBeenCalledWith("Content script boundary cleanup failed", error);
            expect(anchors.every(anchor => anchor.childElementCount === 0)).toBe(true);
        } finally {
            await builder.destroy();
            logged.mockRestore();
            anchors.forEach(anchor => anchor.remove());
        }

        expect(cleanup).toHaveBeenCalledTimes(2);
    }
);

test("boundary cleanup does not hide the original render failure", async () => {
    const original = new Error("Render failed");
    const cleanup = new Error("Cleanup failed");
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    const builder = new Builder(
        defineContentScript({
            anchor: document.body,
            isolation: "shadow",
            boundary: () => () => {
                throw cleanup;
            },
            render: () => {
                throw original;
            },
        })
    );

    try {
        await builder.build();
        expect(logged).toHaveBeenCalledWith("Content script boundary cleanup failed", cleanup);
        await waitFor(() => expect(builder.getContext().nodes.size).toBe(0));
        const aggregate = logged.mock.calls.find(([error]) => error instanceof AggregateError)?.[0] as AggregateError;
        expect(aggregate.errors).toEqual([original]);
        expect(builder.getContext().nodes.size).toBe(0);
    } finally {
        await builder.destroy();
        logged.mockRestore();
    }
});
