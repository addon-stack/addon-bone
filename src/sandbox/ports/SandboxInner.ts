import {sandboxChannel, sandboxSender} from "../utils";

import type {SandboxEnvelope, SandboxPort} from "@typing/sandbox";
import type {MessageSender} from "@typing/message";

/**
 * Sandbox-side `SandboxPort`: runs inside the iframe. There is no frame to create, so
 * `connect` resolves immediately (the ready handshake is posted by the sandbox builder);
 * `post` targets `window.parent`; `subscribe` listens for messages from the parent.
 */
export default class SandboxInner implements SandboxPort {
    private readonly channel: string;

    private unsubscribe?: () => void;

    constructor(private readonly name: string) {
        this.channel = sandboxChannel(name);
    }

    public connect(): Promise<void> {
        return Promise.resolve();
    }

    public post(message: SandboxEnvelope): void {
        // Opaque sandbox origin: no concrete targetOrigin is possible; the host trusts
        // messages by channel + name + requestId, never by origin.
        window.parent.postMessage(message, "*");
    }

    public subscribe(onMessage: (message: SandboxEnvelope, sender: MessageSender) => void): () => void {
        if (this.unsubscribe) {
            return this.unsubscribe;
        }

        const listener = (event: MessageEvent) => {
            if (event.source !== window.parent) {
                return;
            }

            const data = event.data as Partial<SandboxEnvelope>;

            if (data?.channel !== this.channel || data.name !== this.name) {
                return;
            }

            onMessage(data as SandboxEnvelope, sandboxSender());
        };

        window.addEventListener("message", listener);

        this.unsubscribe = () => {
            window.removeEventListener("message", listener);
            this.unsubscribe = undefined;
        };

        return this.unsubscribe;
    }

    public dispose(): void {
        this.unsubscribe?.();
    }
}
