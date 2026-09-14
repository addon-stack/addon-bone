import path from "path";
import {spawnSync} from "child_process";

export type CdpTarget = {
    id: string;
    type: string;
    url: string;
};

export const findChromeBinary = (rootDir: string): string | undefined => {
    if (process.env.ADNBN_CHROME_BIN) {
        return process.env.ADNBN_CHROME_BIN;
    }

    const result = spawnSync(
        process.execPath,
        [path.join(rootDir, "node_modules", "chrome-launcher", "bin", "print-chrome-path.cjs")],
        {encoding: "utf8"}
    );
    const chromePath = result.status === 0 ? result.stdout.trim() : "";

    return chromePath || undefined;
};

export const targets = async (port: number): Promise<CdpTarget[]> => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {signal: AbortSignal.timeout(5_000)});

    return response.json() as Promise<CdpTarget[]>;
};

export const browserVersion = async (port: number): Promise<{webSocketDebuggerUrl: string}> => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {signal: AbortSignal.timeout(5_000)});

    return response.json() as Promise<{webSocketDebuggerUrl: string}>;
};
