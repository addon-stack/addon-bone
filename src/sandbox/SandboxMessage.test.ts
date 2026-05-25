import {nanoid} from "nanoid";

import SandboxMessage from "./SandboxMessage";
import {SandboxMemory} from "./ports";

import type {SandboxParameters} from "@typing/sandbox";

describe("SandboxMessage", () => {
    test("round-trips a request to the sandbox handler and resolves the response", async () => {
        const [hostPort, guestPort] = SandboxMemory.pair();
        const host = new SandboxMessage("parser", hostPort, {requestTimeout: 1000});
        const guest = new SandboxMessage("parser", guestPort);

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
        const host = new SandboxMessage("parser", hostPort, {requestTimeout: 1000});
        const guest = new SandboxMessage("parser", guestPort);

        guest.watch(() => {
            throw new TypeError("bad html");
        });

        const error = await host.send({path: "parse", args: []}).catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(TypeError);
        expect((error as Error).message).toBe("bad html");
    });

    test("rejects when no response arrives before requestTimeout", async () => {
        const [hostPort] = SandboxMemory.pair(); // nothing watches the guest end

        const host = new SandboxMessage("parser", hostPort, {requestTimeout: 10});

        await expect(host.send({path: "parse", args: []})).rejects.toThrow('Sandbox "parser" request');
    });

    test("concurrent requests share the channel and all resolve", async () => {
        // nanoid is globally mocked to a constant in tests; give each request a unique id.
        let counter = 0;
        jest.mocked(nanoid).mockImplementation(() => `req-${++counter}`);

        const [hostPort, guestPort] = SandboxMemory.pair();
        const host = new SandboxMessage("parser", hostPort, {requestTimeout: 1000});
        const guest = new SandboxMessage("parser", guestPort);

        guest.watch(({args}) => args[0]);

        await expect(
            Promise.all([
                host.send({path: "echo", args: [1]}),
                host.send({path: "echo", args: [2]}),
                host.send({path: "echo", args: [3]}),
            ])
        ).resolves.toEqual([1, 2, 3]);
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
