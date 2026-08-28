import type {SandboxEnvelope, SandboxPort} from "@typing/sandbox";
import type {MessageSender} from "@typing/message";

const MemorySender = {url: "memory:", origin: "memory:"} as MessageSender;

/**
 * In-memory `SandboxPort` used in tests. A linked pair of endpoints delivers each posted
 * envelope to the other end asynchronously (microtask), mimicking `postMessage` without a
 * DOM. Lets `SandboxMessage`'s correlation be tested end-to-end and deterministically.
 */
class MemoryPort implements SandboxPort {
    private peer?: MemoryPort;

    private readonly listeners: Set<(message: SandboxEnvelope, sender: MessageSender) => void> = new Set();

    public link(peer: MemoryPort): void {
        this.peer = peer;
    }

    public connect(): Promise<void> {
        return Promise.resolve();
    }

    public post(message: SandboxEnvelope): void {
        const peer = this.peer;

        if (!peer) {
            return;
        }

        queueMicrotask(() => {
            for (const listener of peer.listeners) {
                listener(message, MemorySender);
            }
        });
    }

    public subscribe(onMessage: (message: SandboxEnvelope, sender: MessageSender) => void): () => void {
        this.listeners.add(onMessage);

        return () => this.listeners.delete(onMessage);
    }

    public dispose(): void {
        this.listeners.clear();
    }
}

export default class SandboxMemory {
    public static pair(): [SandboxPort, SandboxPort] {
        const host = new MemoryPort();
        const guest = new MemoryPort();

        host.link(guest);
        guest.link(host);

        return [host, guest];
    }
}
