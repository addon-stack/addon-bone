import SandboxFrame from "../SandboxFrame";
import SandboxMessage from "../SandboxMessage";
import RegisterSandbox from "./RegisterSandbox";
import {sandboxChannel} from "../utils";

import {SandboxReadyMessageType, SandboxRequestMessageType, SandboxResponseMessageType} from "@typing/sandbox";

const ready = (name: string, frame: HTMLIFrameElement) => {
    window.dispatchEvent(
        new MessageEvent("message", {
            source: frame.contentWindow,
            data: {
                type: SandboxReadyMessageType,
                channel: sandboxChannel(name),
                name,
            },
        })
    );
};

const waitFor = async (condition: () => boolean, tries = 100): Promise<void> => {
    for (let i = 0; i < tries; i++) {
        if (condition()) {
            return;
        }

        await Promise.resolve();
    }

    throw new Error("waitFor: condition was not met in time");
};

describe("Sandbox host runtime", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        jest.useRealTimers();
    });

    test("creates one iframe for parallel first calls", async () => {
        const frames = new SandboxFrame();
        const first = frames.make("parser", {url: "sandbox.html"});
        const second = frames.make("parser", {url: "sandbox.html"});
        const frame = document.querySelector("iframe") as HTMLIFrameElement;

        expect(document.querySelectorAll("iframe")).toHaveLength(1);

        ready("parser", frame);

        await expect(first).resolves.toBe(frame);
        await expect(second).resolves.toBe(frame);
    });

    test("host channel posts over the iframe and resolves the matching response", async () => {
        const message = SandboxMessage.for("parser", {url: "sandbox.html", requestTimeout: 1000});
        const send = message.send({path: "parse", args: ["<p>Hi</p>"]});

        const frame = document.querySelector("iframe") as HTMLIFrameElement;
        const postMessage = jest.fn();
        Object.defineProperty(frame.contentWindow, "postMessage", {configurable: true, value: postMessage});

        ready("parser", frame);

        await waitFor(() => postMessage.mock.calls.length > 0);
        const request = postMessage.mock.calls[0][0];

        window.dispatchEvent(
            new MessageEvent("message", {
                source: frame.contentWindow,
                data: {
                    type: SandboxResponseMessageType,
                    channel: sandboxChannel("parser"),
                    name: "parser",
                    requestId: request.requestId,
                    ok: true,
                    payload: 2,
                },
            })
        );

        await expect(send).resolves.toBe(2);

        message.dispose();
    });

    test("rebuild (register → destroy → register) handles each request once", async () => {
        const handler = jest.fn(() => 1);

        const first = new RegisterSandbox("rebuilt", () => ({run: handler}));
        first.register();
        first.destroy();

        const second = new RegisterSandbox("rebuilt", () => ({run: handler}));
        second.register();

        window.dispatchEvent(
            new MessageEvent("message", {
                source: window.parent,
                data: {
                    type: SandboxRequestMessageType,
                    channel: sandboxChannel("rebuilt"),
                    name: "rebuilt",
                    requestId: "rebuilt-req",
                    path: "run",
                    args: [],
                },
            })
        );

        await Promise.resolve();
        await Promise.resolve();

        expect(handler).toHaveBeenCalledTimes(1);

        second.destroy();
    });

    test("ready timeout reports that the frame loaded but never signaled ready", async () => {
        jest.useFakeTimers();

        const creation = new SandboxFrame().make("parser", {url: "sandbox.html", readyTimeout: 100});
        const assertion = expect(creation).rejects.toThrow("never signaled ready");

        const frame = document.querySelector("iframe") as HTMLIFrameElement;
        frame.dispatchEvent(new Event("load"));

        jest.advanceTimersByTime(100);

        await assertion;

        jest.useRealTimers();
    });
});
