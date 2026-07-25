/**
 * Published fallback for the `adnbn/virtual/relay` data module. Inside an adnbn build the bundler's
 * `resolve.alias` overrides this with the live relay options map; safe empty default otherwise.
 */
import type {RelayOptions} from "@typing/relay";

export const relays: Record<string, RelayOptions> = {};
