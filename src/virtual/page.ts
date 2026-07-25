/**
 * Published fallback for the `adnbn/virtual/page` data module. Inside an adnbn build the bundler's
 * `resolve.alias` overrides this with the live alias→filename map; safe empty default otherwise.
 */
export const pages: Record<string, string> = {};
