import {verifySidebar} from "./sidebar";

jest.setTimeout(90_000);

test.each([2, 3] as const)("updates sidebar API state without errors in Firefox MV%i", async version => {
    await verifySidebar("firefox", version);
});
