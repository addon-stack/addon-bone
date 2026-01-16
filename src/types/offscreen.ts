import {TransportConfig, TransportDefinition, TransportType} from "@typing/transport";
import {ViewOptions} from "@typing/view";
import {Awaiter} from "@typing/helpers";

export const OffscreenGlobalKey = "adnbnOffscreen";
export const OffscreenGlobalAccess = "adnbnOffscreenAccess";

export enum OffscreenReason {
    /** A reason used for testing purposes only. */
    Testing = "TESTING",
    /** The offscreen document is responsible for playing audio. */
    AudioPlayback = "AUDIO_PLAYBACK",
    /** The offscreen document needs to embed and script an iframe in order to modify the iframe's content. */
    IframeScripting = "IFRAME_SCRIPTING",
    /** The offscreen document needs to embed an iframe and scrape its DOM to extract information. */
    DOMScraping = "DOM_SCRAPING",
    /** The offscreen document needs to interact with Blob objects (including URL.createObjectURL()). */
    Blobs = "BLOBS",
    /** The offscreen document needs to use the DOMParser API. */
    DOMParser = "DOM_PARSER",
    /** The offscreen document needs to interact with media streams from user media (e.g. getUserMedia()). */
    UserMedia = "USER_MEDIA",
    /** The offscreen document needs to interact with media streams from display media (e.g. getDisplayMedia()). */
    DisplayMedia = "DISPLAY_MEDIA",
    /** The offscreen document needs to use WebRTC APIs. */
    WebRTC = "WEB_RTC",
    /** The offscreen document needs to interact with the clipboard APIs(e.g. Navigator.clipboard). */
    Clipboard = "CLIPBOARD",
    /** Specifies that the offscreen document needs access to localStorage. */
    LocalStorage = "LOCAL_STORAGE",
    /** Specifies that the offscreen document needs to spawn workers. */
    Workers = "WORKERS",
    /** Specifies that the offscreen document needs to use navigator.getBattery. */
    BatteryStatus = "BATTERY_STATUS",
    /** Specifies that the offscreen document needs to use window.matchMedia. */
    MatchMedia = "MATCH_MEDIA",
    /** Specifies that the offscreen document needs to use navigator.geolocation. */
    Geolocation = "GEOLOCATION",
}

export interface OffscreenConfig extends TransportConfig {
    reasons?: `${OffscreenReason}` | `${OffscreenReason}`[] | OffscreenReason | OffscreenReason[];
    justification?: string;
}

export type OffscreenOptions = OffscreenConfig & ViewOptions;

export type OffscreenEntrypointOptions = Partial<OffscreenOptions>;

export type OffscreenMainHandler<T extends TransportType> = (
    offscreen: T,
    options: OffscreenEntrypointOptions
) => Awaiter<void>;

export interface OffscreenDefinition<T extends TransportType>
    extends TransportDefinition<OffscreenOptions, T>, OffscreenEntrypointOptions {
    main?: OffscreenMainHandler<T>;
}

export type OffscreenUnresolvedDefinition<T extends TransportType> = Partial<OffscreenDefinition<T>>;
