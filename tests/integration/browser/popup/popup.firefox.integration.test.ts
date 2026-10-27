import {verifyPopup} from "./popup";

jest.setTimeout(90_000);

test.each([2, 3] as const)("Firefox MV%i keeps document titles and global/tab tooltips independent", async version => {
    await verifyPopup("firefox", version, "omitted");
});
