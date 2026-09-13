import {FrameNode, Node, MountNode} from "./index";
import {getContentScriptStylesRuntime} from "./isolated-styles";

jest.mock("@addon-core/browser", () => ({getUrl: (file: string) => `chrome-extension://fixture/${file}`}));
jest.mock("./isolated-styles", () => ({getContentScriptStylesRuntime: jest.fn()}));

test("FrameNode explains a disconnected host and allows mounting again once the mounter connects it", () => {
    const runtime = {initialize: jest.fn(), add: jest.fn(), delete: jest.fn(), load: jest.fn()};
    jest.mocked(getContentScriptStylesRuntime).mockReturnValue(runtime);
    const anchor = document.createElement("section");
    const container = document.createElement("div");
    document.body.append(anchor);
    let connect = false;
    const node = new FrameNode(
        new MountNode(new Node(anchor, container), (anchor, container) => {
            if (connect) anchor.append(container);
        }),
        {type: "iframe"},
        () => {}
    );
    try {
        expect(() => node.mount()).toThrow(/container is not connected.*mount must attach/);
        expect(container.querySelector("iframe")).toBeNull();
        expect(runtime.add).not.toHaveBeenCalled();
        connect = true;
        expect(node.mount()).toBe(true);
        expect(node.target?.isConnected).toBe(true);
        const frame = container.querySelector("iframe")!;
        frame.contentDocument!.head.remove();
        expect(() => node.mount()).toThrow(/no accessible document/);
    } finally {
        node.unmount();
        anchor.remove();
    }
});

test("FrameNode does not require a connected host for document navigation", () => {
    const container = document.createElement("div");
    const node = new FrameNode(
        new Node(document.createElement("section"), container),
        {type: "iframe", src: "https://example.com"},
        () => {}
    );
    try {
        expect(node.mount()).toBe(true);
        expect(container.querySelector("iframe")?.src).toBe("https://example.com/");
        expect(node.target).toBeUndefined();
    } finally {
        node.unmount();
    }
});

test("FrameNode replaces lost targets, unregisters old styles and releases its load callback", async () => {
    const runtime = {initialize: jest.fn(), add: jest.fn(), delete: jest.fn(), load: jest.fn()};
    jest.mocked(getContentScriptStylesRuntime).mockReturnValue(runtime);
    const anchor = document.createElement("section");
    document.body.append(anchor);
    const recover = jest.fn();
    const node = new FrameNode(
        new MountNode(new Node(anchor, document.createElement("div")), (anchor, container) => {
            anchor.append(container);
        }),
        {type: "iframe", height: 320},
        recover
    );
    node.mount();
    const frame = node.container!.querySelector("iframe")!;
    const target = node.target!;
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.style.height).toBe("320px");
    expect(target.ownerDocument).toBe(frame.contentDocument);
    expect(runtime.add).toHaveBeenLastCalledWith(frame.contentDocument!.head, null, false);
    // An initial load on an intact document does not start recovery or enable retries.
    frame.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(recover).not.toHaveBeenCalled();
    target.remove();
    frame.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(recover).toHaveBeenCalledTimes(1);
    node.mount();
    expect(node.target).not.toBe(target);
    expect(runtime.delete).toHaveBeenCalledTimes(1);
    expect(runtime.add).toHaveBeenLastCalledWith(frame.contentDocument!.head, null, true);
    node.unmount();
    frame.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(recover).toHaveBeenCalledTimes(1);
    node.mount();
    expect(node.container!.querySelector("iframe")).not.toBe(frame);
    expect(runtime.add).toHaveBeenLastCalledWith(node.target!.ownerDocument!.head, null, false);
    node.unmount();
    anchor.remove();
});
