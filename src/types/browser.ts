export enum Browser {
    Chrome = "chrome",
    Chromium = "chromium",
    Edge = "edge",
    Firefox = "firefox",
    Opera = "opera",
    Safari = "safari",
}

export interface VersionSpecific {
    strictMinVersion?: string;
    strictMaxVersion?: string;
}

export interface GeckoSpecific extends VersionSpecific {
    id?: string;
    updateUrl?: string;
}

export interface BrowserSpecific {
    gecko?: GeckoSpecific;
    geckoAndroid?: VersionSpecific;
    safari?: VersionSpecific;
}
