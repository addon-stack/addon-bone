/**
 * Published fallback for the `adnbn/virtual/sandbox` data module. Inside an adnbn build the
 * bundler's `resolve.alias` overrides this with the live parameters map; safe empty default otherwise.
 */
import type {SandboxParameters} from "@typing/sandbox";

export const sandboxes: Record<string, SandboxParameters> = {};
