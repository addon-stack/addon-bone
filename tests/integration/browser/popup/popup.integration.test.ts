import {verifyPopup} from "./popup";

jest.setTimeout(90_000);

test("Chrome MV3 keeps document titles and global/tab tooltips independent", async () => {
    await verifyPopup("chrome", 3, "literal");
});
