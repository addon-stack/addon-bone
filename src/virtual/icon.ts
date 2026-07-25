/**
 * Published fallback for the `adnbn/virtual/icon` data module. Inside an adnbn build the bundler's
 * `resolve.alias` overrides this with the live icon-groups map; safe empty default otherwise.
 */
export const icons: Record<string, Record<number, string>> = {};
