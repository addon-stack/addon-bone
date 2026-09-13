import {existsSync} from "fs";
import path from "path";

export const findFirefoxBinary = (): string | undefined => {
    if (process.env.ADNBN_FIREFOX_BIN) {
        return process.env.ADNBN_FIREFOX_BIN;
    }

    const filename = process.platform === "win32" ? "firefox.exe" : "firefox";
    const candidates = [
        "/Applications/Firefox.app/Contents/MacOS/firefox",
        ...[process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
            .filter((directory): directory is string => Boolean(directory))
            .map(directory => path.join(directory, "Mozilla Firefox", filename)),
        ...(process.env.PATH ?? "")
            .split(path.delimiter)
            .filter(Boolean)
            .map(directory => path.resolve(directory, filename)),
    ];

    return candidates.find(candidate => existsSync(candidate));
};
