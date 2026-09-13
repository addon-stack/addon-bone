/** @jest-environment node */
import {once} from "events";
import {createConnection} from "net";
import path from "path";

import {startIntegrationSite} from "./site";

test("closes speculative browser connections that have not sent an HTTP request", async () => {
    const site = await startIntegrationSite(path.resolve(__dirname, "../content/isolation-shadow/site"));
    const socket = createConnection({host: "127.0.0.1", port: Number(new URL(site.origin).port)});
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let closing: Promise<void> | undefined;

    try {
        await once(socket, "connect");
        // A forced server teardown can surface as FIN or ECONNRESET, depending on the platform.
        // Both must end in close; a reset is not a connection-establishment failure here.
        const closed = new Promise<void>((resolve, reject) => {
            socket.once("close", () => resolve());
            socket.once("error", (error: NodeJS.ErrnoException) => {
                if (error.code !== "ECONNRESET") reject(error);
            });
        });
        closing = site.close();
        await Promise.race([
            Promise.all([closing, closed]),
            new Promise<never>((_, reject) => {
                timeout = setTimeout(() => reject(new Error("Test server did not close its idle connection")), 2_000);
            }),
        ]);
        expect(socket.destroyed).toBe(true);
    } finally {
        clearTimeout(timeout);
        socket.destroy();
        await (closing ?? site.close());
    }
});
