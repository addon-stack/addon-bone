import {startBrowserTest, stopBrowserTest} from "./browser-harness/session";

beforeEach(startBrowserTest);

afterEach(async () => {
    try {
        await stopBrowserTest();
    } finally {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        jest.useRealTimers();
    }
});
