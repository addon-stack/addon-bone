import {Browser} from "@typing/browser";
import {ManifestVersion} from "@typing/manifest";

export const getEnv = <T extends string, D = undefined>(key: string, defaults?: D): T | D => {
    let env: object = {};

    if (typeof process.env === "object") {
        env = process.env;
    }

    return env[key] ?? defaults;
};

export const getApp = (): string => {
    const app = getEnv("APP");

    if (app === undefined) {
        throw new Error("App is not defined");
    }

    return app;
};

export const getBrowser = (): Browser => {
    const browser = getEnv<Browser>("BROWSER");

    if (browser === undefined) {
        throw new Error("Browser is not defined");
    }

    return browser;
};

export const isBrowser = (browser: Browser): browser is Browser => {
    return getBrowser() === browser;
};

export const getManifestVersion = (): ManifestVersion => {
    const manifestVersion = getEnv("MANIFEST_VERSION", "3");

    return parseInt(manifestVersion) as ManifestVersion;
};
