/**
 * Published fallback for the `adnbn/virtual/sidebar` data module. Inside an adnbn build the
 * bundler's `resolve.alias` overrides this with the live sidebar map; safe empty default otherwise.
 */
import type {ManifestSidebar} from "@typing/manifest";

export const sidebars: Record<string, ManifestSidebar> = {};
