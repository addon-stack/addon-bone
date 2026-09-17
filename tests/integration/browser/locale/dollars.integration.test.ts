import {verifyLocaleDollars} from "./dollars";

jest.setTimeout(90_000);

test("Chrome preserves literal dollars in native and dynamic YAML translations", async () => {
    await verifyLocaleDollars("chrome");
});
