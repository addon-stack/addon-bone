import {getBrowserTest} from "@tests/browser-harness/session";

import SandboxMessage from "./SandboxMessage";
import {SandboxMemory} from "./ports";

import type {SandboxParameters, SandboxPort} from "@typing/sandbox";

const createMessage = (port: SandboxPort, parameters: Partial<SandboxParameters> = {}): SandboxMessage => {
    const message = new SandboxMessage("parser", port, parameters);

    getBrowserTest().addCleanup(() => message.dispose());

    return message;
};

describe("SandboxMessage", () => {
    test("round-trips a request to the sandbox handler and resolves the response", async () => {
        const [hostPort, guestPort] = SandboxMemory.pair();
        const host = createMessage(hostPort, {requestTimeout: 1000});
        const guest = createMessage(guestPort);

        let receivedPath: string | undefined;

        guest.watch(({path, args}) => {
            receivedPath = path;

            return (args[0] as string).length;
        });

        await expect(host.send({path: "parse", args: ["<p>Hello</p>"]})).resolves.toBe(12);
        expect(receivedPath).toBe("parse");
    });

    test("propagates handler errors back to the caller", async () => {
        const [hostPort, guestPort] = SandboxMemory.pair();
        const host = createMessage(hostPort, {requestTimeout: 1000});
        const guest = createMessage(guestPort);

        guest.watch(() => {
            throw new TypeError("bad html");
        });

        const error = await host.send({path: "parse", args: []}).catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(TypeError);
        expect((error as Error).message).toBe("bad html");
    });

    test("rejects when no response arrives before requestTimeout", async () => {
        jest.useFakeTimers();

        const [hostPort, guestPort] = SandboxMemory.pair();
        const host = createMessage(hostPort, {requestTimeout: 10});

        createMessage(guestPort); // nothing watches the guest end

        const result = expect(host.send({path: "parse", args: []})).rejects.toThrow('Sandbox "parser" request');

        await jest.advanceTimersByTimeAsync(0);
        expect(jest.getTimerCount()).toBe(1);
        await jest.advanceTimersByTimeAsync(9);
        expect(jest.getTimerCount()).toBe(1);
        await jest.advanceTimersByTimeAsync(1);
        await result;
        expect(jest.getTimerCount()).toBe(0);
    });

    test("correlates concurrent requests when responses arrive in reverse order", async () => {
        jest.useFakeTimers();

        const [hostPort, guestPort] = SandboxMemory.pair();
        const host = createMessage(hostPort, {requestTimeout: 1000});
        const guest = createMessage(guestPort);
        const completed: number[] = [];

        guest.watch(({args}) => {
            const value = args[0] as number;

            return new Promise<number>(resolve => {
                setTimeout(
                    () => {
                        completed.push(value);
                        resolve(value);
                    },
                    (4 - value) * 10
                );
            });
        });

        const result = Promise.all([
            host.send({path: "echo", args: [1]}),
            host.send({path: "echo", args: [2]}),
            host.send({path: "echo", args: [3]}),
        ]);

        await jest.advanceTimersByTimeAsync(30);
        await expect(result).resolves.toEqual([1, 2, 3]);
        expect(completed).toEqual([3, 2, 1]);
        expect(jest.getTimerCount()).toBe(0);
    });

    test("rejects pending requests and clears their timers on dispose", async () => {
        jest.useFakeTimers();

        const [hostPort, guestPort] = SandboxMemory.pair();
        const host = createMessage(hostPort, {requestTimeout: 1000});

        createMessage(guestPort);

        const result = expect(host.send({path: "parse", args: []})).rejects.toThrow('Sandbox "parser" was disposed.');

        await jest.advanceTimersByTimeAsync(0);
        expect(jest.getTimerCount()).toBe(1);
        host.dispose();
        await result;
        expect(jest.getTimerCount()).toBe(0);
    });

    test("caches one host channel per name and re-creates after dispose", () => {
        const params: SandboxParameters = {url: "sandbox.html"};

        const first = SandboxMessage.for("cached", params);
        const second = SandboxMessage.for("cached", params);

        expect(second).toBe(first);

        first.dispose();

        expect(SandboxMessage.for("cached", params)).not.toBe(first);
    });
});
