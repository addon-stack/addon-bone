import {sandboxChannel, sandboxSender} from "../utils";
import SandboxFrame from "../SandboxFrame";

import type {SandboxEnvelope, SandboxParameters, SandboxPort} from "@typing/sandbox";
import type {MessageSender} from "@typing/message";

/**
 * Host-side `SandboxPort`: runs in an extension page, owns the sandbox iframe.
 * `connect` creates the iframe and awaits its ready handshake (via `SandboxFrame`);
 * `post` targets the iframe's `contentWindow`; `subscribe` attaches a single `message`
 * listener filtered to that frame.
 */
export default class SandboxHost implements SandboxPort {
    private readonly frames = new SandboxFrame();

    private readonly channel: string;

    private frame?: HTMLIFrameElement;

    private unsubscribe?: () => void;

    constructor(
        private readonly name: string,
        private readonly parameters: SandboxParameters
    ) {
        this.channel = sandboxChannel(name);
    }

    public async connect(): Promise<void> {
        this.frame = await this.frames.make(this.name, this.parameters);
    }

    public post(message: SandboxEnvelope): void {
        const target = this.frame?.contentWindow;

        if (!target) {
            throw new Error(`Sandbox "${this.name}" is not available.`);
        }

        // Sandboxed iframes have an opaque origin, so no concrete targetOrigin is possible.
        // Inbound messages are trusted by channel + name + requestId, never by origin.
        target.postMessage(message, "*");
    }

    public subscribe(onMessage: (message: SandboxEnvelope, sender: MessageSender) => void): () => void {
        if (this.unsubscribe) {
            return this.unsubscribe;
        }

        const listener = (event: MessageEvent) => {
            if (event.source !== this.frame?.contentWindow) {
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
        this.frames.remove(this.name);
        this.frame = undefined;
    }
}
