import os from "os";
import path from "path";

import CdpPipeClient from "./CdpPipeClient";

const missingBinary = path.join(os.tmpdir(), "adnbn-missing-chrome", "chrome");

describe("CdpPipeClient", () => {
    test("reports a launch failure instead of waiting for an exit that never comes", async () => {
        const client = CdpPipeClient.launch(missingBinary, []);
        const exit = await client.waitForExit(5_000);

        expect(exit?.error).toMatchObject({code: "ENOENT"});
        await expect(client.send("Browser.getVersion", {}, undefined, 60_000)).rejects.toMatchObject({
            code: "ENOENT",
        });
        await expect(client.close(1_000)).resolves.toBe(exit);
    });

    test("closes a client whose launch failure has not been reported yet", async () => {
        const client = CdpPipeClient.launch(missingBinary, []);
        const exit = await client.close(1_000);

        expect(exit.error).toMatchObject({code: "ENOENT"});
    });
});
