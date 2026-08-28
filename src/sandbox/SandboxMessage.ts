import {nanoid} from "nanoid";

import {sandboxChannel} from "./utils";
import {SandboxHost} from "./ports";

import {restoreError, serializeError} from "@message/error";
import {
    SandboxParameters,
    SandboxPort,
    SandboxRequestMessage,
    SandboxRequestMessageType,
    SandboxResponseMessage,
    SandboxResponseMessageType,
} from "@typing/sandbox";
import type {MessageSender} from "@typing/message";
import type {TransportMessage, TransportMessageData} from "@typing/transport";

type Pending = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: ReturnType<typeof setTimeout>;
};

const DefaultRequestTimeout = 30000;

/**
 * The standard transport channel (`send`/`watch`) for the sandbox layer, implemented over
 * `window.postMessage` instead of the chrome.runtime `Message` provider. All request/response
 * correlation (requestId, pending map, timeouts, error serialize/restore) lives here, behind
 * the standard interface; the raw wire sits below in a `SandboxPort`.
 */
export default class SandboxMessage implements TransportMessage {
    private static readonly hosts: Map<string, SandboxMessage> = new Map();

    private readonly channel: string;

    private readonly pending: Map<string, Pending> = new Map();

    private listenUnsubscribe?: () => void;

    private watchUnsubscribe?: () => void;

    constructor(
        private readonly name: string,
        private readonly port: SandboxPort,
        private readonly parameters: Partial<SandboxParameters> = {}
    ) {
        this.channel = sandboxChannel(name);
    }

    /**
     * Host-side channel, cached per name. One cached instance means one peer listener per
     * sandbox no matter how many times `getSandbox()` is called — this is the leak fix.
     */
    public static for(name: string, parameters: SandboxParameters): SandboxMessage {
        let message = this.hosts.get(name);

        if (!message) {
            message = new SandboxMessage(name, new SandboxHost(name, parameters), parameters);

            this.hosts.set(name, message);
        }

        return message;
    }

    public async send(data: TransportMessageData): Promise<any> {
        await this.port.connect();

        this.listen();

        const requestId = nanoid();
        const request: SandboxRequestMessage = {
            type: SandboxRequestMessageType,
            channel: this.channel,
            name: this.name,
            requestId,
            path: data.path,
            args: data.args,
        };

        const requestTimeout = this.parameters.requestTimeout ?? DefaultRequestTimeout;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(requestId);

                if (this.parameters.removeOnRequestTimeout && this.pending.size === 0) {
                    this.dispose();
                }

                reject(new Error(`Sandbox "${this.name}" request "${requestId}" timed out.`));
            }, requestTimeout);

            this.pending.set(requestId, {resolve, reject, timeout});

            this.port.post(request);
        });
    }

    public watch(handler: (data: TransportMessageData, sender: MessageSender) => any): () => void {
        if (this.watchUnsubscribe) {
            return this.watchUnsubscribe;
        }

        const unsubscribe = this.port.subscribe(async (message, sender) => {
            if (message.type !== SandboxRequestMessageType) {
                return;
            }

            try {
                const payload = await handler({path: message.path, args: message.args ?? []}, sender);

                this.respond({requestId: message.requestId, ok: true, payload});
            } catch (error) {
                this.respond({requestId: message.requestId, ok: false, error: serializeError(error)});
            }
        });

        this.watchUnsubscribe = unsubscribe;

        return unsubscribe;
    }

    public dispose(): void {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error(`Sandbox "${this.name}" was disposed.`));
        }

        this.pending.clear();

        this.listenUnsubscribe?.();
        this.listenUnsubscribe = undefined;

        this.watchUnsubscribe?.();
        this.watchUnsubscribe = undefined;

        this.port.dispose();

        SandboxMessage.hosts.delete(this.name);
    }

    private listen(): void {
        if (this.listenUnsubscribe) {
            return;
        }

        this.listenUnsubscribe = this.port.subscribe(message => {
            if (message.type !== SandboxResponseMessageType) {
                return;
            }

            const pending = this.pending.get(message.requestId);

            if (!pending) {
                return;
            }

            clearTimeout(pending.timeout);
            this.pending.delete(message.requestId);

            if (message.ok) {
                pending.resolve(message.payload);
            } else {
                pending.reject(restoreError(message.error));
            }
        });
    }

    private respond(response: Omit<SandboxResponseMessage, "type" | "channel" | "name">): void {
        this.port.post({
            type: SandboxResponseMessageType,
            channel: this.channel,
            name: this.name,
            ...response,
        });
    }
}
