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
    /** Contact and identifying information such as name, address, email, etc. */
    PersonallyIdentifyingInfo = "personallyIdentifyingInfo",
    /** Medical information, including medical history, diagnoses and treatments */
    HealthInfo = "healthInfo",
    /** Financial and payment data (cards, transactions, credit scores) */
    FinancialAndPaymentInfo = "financialAndPaymentInfo",
    /** Authentication data (usernames, passwords, PIN codes) */
    AuthenticationInfo = "authenticationInfo",
    /** Personal communications (emails, chats, social‑media messages) */
    PersonalCommunications = "personalCommunications",
    /** Location data (region, GPS coordinates and similar) */
    LocationInfo = "locationInfo",
    /** Information about websites visited and pages viewed */
    BrowsingActivity = "browsingActivity",
    /** Content of web pages (text, images, video, links and embedded elements) */
    WebsiteContent = "websiteContent",
    /** User activity on websites (scrolling, clicks, typing, downloads) */
    WebsiteActivity = "websiteActivity",
    /** Search terms entered in search engines or the address bar */
    SearchTerms = "searchTerms",
    /** Firefox bookmark data: URLs, titles, folder names */
    BookmarksInfo = "bookmarksInfo",
    /** Technical and usage data (device/browser info, extension settings, crash reports) */
    TechnicalAndInteraction = "technicalAndInteraction",
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
