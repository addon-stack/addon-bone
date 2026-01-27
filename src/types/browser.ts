export enum Browser {
    Chrome = "chrome",
    Chromium = "chromium",
    Edge = "edge",
    Firefox = "firefox",
    Opera = "opera",
    Safari = "safari",
}

/**
 * Enum representing various types of data collection permissions.
 * Each permission corresponds to a specific category of data that can be collected.
 *
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings#data_collection_permissions
 */
export enum DataCollectionPermission {
    AuthenticationInfo = "authenticationInfo",
    BookmarksInfo = "bookmarksInfo",
    BrowsingActivity = "browsingActivity",
    FinancialAndPaymentInfo = "financialAndPaymentInfo",
    HealthInfo = "healthInfo",
    LocationInfo = "locationInfo",
    PersonalCommunications = "personalCommunications",
    PersonallyIdentifyingInfo = "personallyIdentifyingInfo",
    SearchTerms = "searchTerms",
    TechnicalAndInteraction = "technicalAndInteraction",
    WebsiteActivity = "websiteActivity",
}

export interface DataCollectionPermissions {
    required?: DataCollectionPermission[] | `${DataCollectionPermission}`[];
    optional?: DataCollectionPermission[] | `${DataCollectionPermission}`[];
}

export interface VersionSpecific {
    strictMinVersion?: string;
    strictMaxVersion?: string;
}

export interface GeckoSpecific extends VersionSpecific {
    id?: string;
    updateUrl?: string;
    dataCollectionPermissions?: DataCollectionPermissions;
}

export interface BrowserSpecific {
    gecko?: GeckoSpecific;
    geckoAndroid?: VersionSpecific;
    safari?: VersionSpecific;
}
