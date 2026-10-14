import {verifySidebar} from "./sidebar";

jest.setTimeout(90_000);

test("switches sidebars without title or icon APIs in Chrome MV3", async () => {
    await verifySidebar("chrome", 3);
});
