import BrowserTestSession from "./BrowserTestSession";

let session: BrowserTestSession | undefined;

export function startBrowserTest(): void {
    if (session) {
        throw new Error("The previous browser test session has not been stopped.");
    }

    session = new BrowserTestSession();
}

export function getBrowserTest(): BrowserTestSession {
    if (!session) {
        throw new Error("Browser harness is unavailable. Use it inside a test or hook outside the legacy exceptions.");
    }

    return session;
}

export async function stopBrowserTest(): Promise<void> {
    try {
        await session?.dispose();
    } finally {
        session = undefined;
    }
}
