import {createServer} from "http";
import {readFile} from "fs/promises";
import path from "path";

export interface IntegrationSite {
    readonly origin: string;
    close(): Promise<void>;
}

export const startIntegrationSite = async (directory: string): Promise<IntegrationSite> => {
    const server = createServer(async (request, response) => {
        try {
            const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

            // Browsers request a favicon independently of the extension under test.
            if (pathname === "/favicon.ico") {
                response.writeHead(204);
                response.end();
                return;
            }

            const filename = path.basename(pathname === "/" ? "top.html" : pathname);
            const content = await readFile(path.join(directory, filename));

            response.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                "Content-Security-Policy": "default-src 'none'; frame-src 'self'; img-src 'self'",
            });
            response.end(content);
        } catch {
            response.writeHead(404);
            response.end("Not found");
        }
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
        server.close();
        throw new Error("Unable to determine the integration site address");
    }

    return {
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
    };
};
