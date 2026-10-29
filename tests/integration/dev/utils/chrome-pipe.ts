import CdpPipeClient from "./CdpPipeClient";

import {findChromeBinary} from "../../browser/utils/chrome";

export const requireChromeBinary = (rootDir: string): string => {
    const binary = findChromeBinary(rootDir);

    if (!binary) {
        throw new Error("Chrome was not found. Set ADNBN_CHROME_BIN to the Chrome executable.");
    }

    return binary;
};

/** Launches Chrome with the flags the dev session uses: a DevTools pipe and a dedicated user data directory. */
export const launchChromePipe = (binary: string, profile: string, extra: string[] = []): CdpPipeClient => {
    return CdpPipeClient.launch(binary, [
        "--headless",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-pipe",
        "--enable-unsafe-extension-debugging",
        `--user-data-dir=${profile}`,
        // GitHub's Ubuntu 24.04 runners restrict the user namespaces the Chrome sandbox needs.
        ...(process.platform === "linux" ? ["--no-sandbox"] : []),
        ...extra,
    ]);
};
