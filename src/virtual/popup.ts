/**
 * Published fallback for the `adnbn/virtual/popup` data module. Inside an adnbn build the bundler's
 * `resolve.alias` overrides this with the live popup map; this stub provides a safe empty default.
 */
import type {ManifestPopup} from "@typing/manifest";

export const popups: Record<string, ManifestPopup> = {};
