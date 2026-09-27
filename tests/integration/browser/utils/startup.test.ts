import {waitForBrowserStartup} from "./startup";

afterEach(() => {
    jest.useRealTimers();
});

test("startup retries share one deadline, including time spent connecting", async () => {
    jest.useFakeTimers();
    const startedAt = performance.now();
    const budgets: number[] = [];
    const failure = new Error("debugging endpoint unavailable");
    const result = waitForBrowserStartup(
        async remaining => {
            budgets.push(remaining());
            await new Promise(resolve => setTimeout(resolve, 400));

            throw failure;
        },
        {timeout: 900, startedAt, description: "chrome startup", checkProcess: () => {}}
    );
    const assertion = expect(result).rejects.toMatchObject({
        message: "Timed out waiting for chrome startup after 900 ms",
        cause: failure,
    });

    await jest.advanceTimersByTimeAsync(900);
    await assertion;
    expect(budgets).toEqual([900, 400]);
});

test("a later successful connection receives only the remaining startup budget", async () => {
    jest.useFakeTimers();
    let attempts = 0;
    const result = waitForBrowserStartup(
        async remaining => {
            attempts++;

            if (attempts === 1) {
                throw new Error("not listening yet");
            }

            return remaining();
        },
        {timeout: 1_000, startedAt: performance.now(), description: "firefox startup", checkProcess: () => {}}
    );

    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(900);
});

test("browser process failure aborts startup without retrying until the deadline", async () => {
    const failure = new Error("browser exited with code 1");
    let attempts = 0;

    await expect(
        waitForBrowserStartup(
            async () => {
                attempts++;

                return true;
            },
            {
                timeout: 30_000,
                startedAt: performance.now(),
                description: "firefox startup",
                checkProcess: () => {
                    throw failure;
                },
            }
        )
    ).rejects.toBe(failure);
    expect(attempts).toBe(0);
});

test("a readiness response delivered after the deadline is not accepted", async () => {
    jest.useFakeTimers();
    const result = waitForBrowserStartup(
        async () => {
            await new Promise(resolve => setTimeout(resolve, 200));

            return "ready";
        },
        {timeout: 100, startedAt: performance.now(), description: "chrome startup", checkProcess: () => {}}
    );
    const assertion = expect(result).rejects.toThrow("Timed out waiting for chrome startup after 100 ms");

    await jest.advanceTimersByTimeAsync(200);
    await assertion;
});
