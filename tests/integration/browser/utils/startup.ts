interface BrowserStartupOptions {
    timeout: number;
    startedAt: number;
    description: string;
    checkProcess(): void;
}

/** Each protocol operation must use remaining() as its own cancellable timeout. */
export const waitForBrowserStartup = async <T>(
    connect: (remaining: () => number) => Promise<T>,
    {timeout, startedAt, description, checkProcess}: BrowserStartupOptions
): Promise<T> => {
    const remaining = () => Math.max(0, Math.ceil(timeout - (performance.now() - startedAt)));
    let lastError: unknown;

    while (remaining() > 0) {
        checkProcess();

        try {
            const value = await connect(() => {
                const budget = remaining();

                if (!budget) {
                    throw new Error(`${description} deadline reached`);
                }

                return budget;
            });

            if (remaining() > 0) {
                return value;
            }
        } catch (error) {
            lastError = error;
        }

        checkProcess();
        const delay = Math.min(100, remaining());

        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`Timed out waiting for ${description} after ${timeout} ms`, {cause: lastError});
};
