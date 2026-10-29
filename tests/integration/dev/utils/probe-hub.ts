import {WebSocketServer} from "ws";
import type {WebSocket} from "ws";

import {waitFor} from "../../browser/utils/browser";

export type ProbeMessage = {
    type: string;
    role?: string;
    version?: string;
    origin?: string;
    tabId?: number;
    frameId?: number;
    documentId?: string;
    url?: string;
    count?: number;
    [key: string]: unknown;
};

export interface ProbeHub {
    readonly port: number;
    readonly messages: ProbeMessage[];
    waitMessage(
        predicate: (message: ProbeMessage) => boolean,
        description: string,
        timeout?: number
    ): Promise<ProbeMessage>;
    sendToLatest(message: Record<string, unknown>): void;
    close(): Promise<void>;
}

/** Loopback WebSocket server that records every message sent by probe service workers. */
export const startProbeHub = async (): Promise<ProbeHub> => {
    const server = new WebSocketServer({host: "127.0.0.1", port: 0});
    const sockets: WebSocket[] = [];
    const messages: ProbeMessage[] = [];

    await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    server.on("connection", (socket, request) => {
        sockets.push(socket);

        socket.on("message", data => {
            messages.push({...(JSON.parse(String(data)) as ProbeMessage), origin: request.headers.origin});
        });
    });

    const address = server.address();

    if (!address || typeof address === "string") {
        throw new Error("The probe hub must listen on a TCP port");
    }

    return {
        port: address.port,
        messages,
        waitMessage: (predicate, description, timeout = 15_000) =>
            waitFor(async () => messages.find(predicate), timeout, description),
        sendToLatest: message => {
            const socket = sockets.at(-1);

            if (!socket) {
                throw new Error("No probe service worker is connected");
            }

            socket.send(JSON.stringify(message));
        },
        close: () =>
            new Promise(resolve => {
                sockets.forEach(socket => socket.terminate());
                server.close(() => resolve());
            }),
    };
};
