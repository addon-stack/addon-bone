/**
 * Published fallback for the `adnbn/virtual/offscreen` data module. Inside an adnbn build the
 * bundler's `resolve.alias` overrides this with the live parameters map; safe empty default otherwise.
 */
export const offscreens: Record<string, chrome.offscreen.CreateParameters> = {};
