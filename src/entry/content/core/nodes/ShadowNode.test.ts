import MountNode from "./MountNode";
import Node from "./Node";
import ShadowNode from "./ShadowNode";
import {getContentScriptStylesRuntime} from "./isolated-styles";
import {
    ContentScriptShadowMode,
    type ContentScriptShadowOptions,
    type ContentScriptStylesRuntime,
} from "@typing/content";

jest.mock("./isolated-styles", () => ({
    getContentScriptStylesRuntime: jest.fn(),
}));

const createNode = (
    runtime: ContentScriptStylesRuntime,
    host = document.createElement("section"),
    options?: ContentScriptShadowOptions
) => {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    jest.mocked(getContentScriptStylesRuntime).mockReturnValue(runtime);

    return {
        anchor,
        host,
        node: new ShadowNode(
            new MountNode(new Node(anchor, host), (_anchor, container) => {
                anchor.appendChild(container);
            }),
            options
        ),
    };
};

describe("ShadowNode", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        jest.clearAllMocks();
    });

    test.each([undefined, {}, {mode: ContentScriptShadowMode.Open}, {mode: ContentScriptShadowMode.Closed}])(
        "registers the root and exposes the target with options %j",
        options => {
            const runtime: ContentScriptStylesRuntime = {
                initialize: jest.fn(),
                add: jest.fn(),
                delete: jest.fn(),
                load: jest.fn(async () => undefined),
            };
            const {host, node} = createNode(runtime, undefined, options);

            expect(node.mount()).toBe(true);
            const root = node.target!.getRootNode() as ShadowRoot;
            expect(root.mode).toBe(options?.mode ?? ContentScriptShadowMode.Open);
            expect(host.shadowRoot).toBe(options?.mode === ContentScriptShadowMode.Closed ? null : root);
            expect(node.target).toBe(root.lastElementChild);
            expect(node.target).not.toBe(host);
            expect(runtime.add).toHaveBeenCalledWith(root, node.target);
            expect(Array.from(root.children).map(element => element.tagName)).toEqual(["DIV"]);

            node.mount();
            expect(runtime.add).toHaveBeenCalledTimes(1);
        }
    );

    test.each([ContentScriptShadowMode.Open, ContentScriptShadowMode.Closed])(
        "unregisters %s before removing the host and creates a new root on remount",
        mode => {
            const states: boolean[] = [];
            const runtime: ContentScriptStylesRuntime = {
                initialize: jest.fn(),
                add: jest.fn(),
                delete: jest.fn(root => states.push((root as ShadowRoot).host.isConnected)),
                load: jest.fn(async () => undefined),
            };
            const {anchor, node} = createNode(runtime, undefined, {mode});

            node.mount();
            const firstHost = node.container;
            const firstRoot = node.target!.getRootNode();

            expect(node.unmount()).toBe(true);
            expect(states).toEqual([true]);
            expect(runtime.delete).toHaveBeenCalledWith(firstRoot);
            expect(node.target).toBeUndefined();
            expect(firstHost?.isConnected).toBe(false);

            expect(node.mount()).toBe(true);
            expect(node.container).not.toBe(firstHost);
            const nextRoot = node.target!.getRootNode() as ShadowRoot;
            expect(nextRoot).not.toBe(firstRoot);
            expect(nextRoot.mode).toBe(mode);
            expect(node.target?.parentNode).toBe(nextRoot);
            expect(anchor.contains(node.container ?? null)).toBe(true);
            expect(runtime.add).toHaveBeenCalledTimes(2);
        }
    );

    test.each([ContentScriptShadowMode.Open, ContentScriptShadowMode.Closed])(
        "preserves event propagation while encapsulating the %s event path",
        mode => {
            const runtime: ContentScriptStylesRuntime = {
                initialize: jest.fn(),
                add: jest.fn(),
                delete: jest.fn(),
                load: jest.fn(async () => undefined),
            };
            const {host, node} = createNode(runtime, undefined, {mode});
            node.mount();
            const button = document.createElement("button");
            node.target!.appendChild(button);
            let eventPath: EventTarget[] = [];
            host.addEventListener("click", event => {
                eventPath = event.composedPath();
            });
            button.click();
            expect(eventPath).toContain(host);
            expect(eventPath.includes(button)).toBe(mode === ContentScriptShadowMode.Open);
        }
    );

    test("rejects a container with an existing open ShadowRoot", () => {
        const runtime: ContentScriptStylesRuntime = {
            initialize: jest.fn(),
            add: jest.fn(),
            delete: jest.fn(),
            load: jest.fn(async () => undefined),
        };
        const host = document.createElement("section");
        host.attachShadow({mode: "open"});
        const {node} = createNode(runtime, host);

        expect(() => node.mount()).toThrow("Content script container already has an open ShadowRoot");
        expect(runtime.add).not.toHaveBeenCalled();
    });

    test("reports an existing closed root without exposing it or registering styles", () => {
        const runtime: ContentScriptStylesRuntime = {
            initialize: jest.fn(),
            add: jest.fn(),
            delete: jest.fn(),
            load: jest.fn(async () => undefined),
        };
        const host = document.createElement("section");
        host.attachShadow({mode: ContentScriptShadowMode.Closed});
        const {node} = createNode(runtime, host, {mode: ContentScriptShadowMode.Closed});
        expect(() => node.mount()).toThrow(/Cannot attach ShadowRoot/);
        expect(runtime.add).not.toHaveBeenCalled();
        expect(node.target).toBeUndefined();
    });
});
