/**
 * Published fallback for the `adnbn/virtual/locale` data module.
 *
 * Inside an adnbn extension build the bundler's `resolve.alias` (see {@link VirtualDataPlugin})
 * overrides this with a live, watch-updated module carrying the real locale keys/languages. This
 * stub only provides safe empty defaults so the bare `adnbn/virtual/locale` import always resolves
 * outside an adnbn build (and never throws at module load before the consumer's guards).
 */
export const keys: string[] = [];

export const locales: string[] = [];

export const defaultLanguage: string = "";
