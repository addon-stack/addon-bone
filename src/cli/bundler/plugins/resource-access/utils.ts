import type {ResourceAccessPluginRequirement} from "./ResourceAccessPlugin";

interface AccessManifest {
    manifest_version: number;
    web_accessible_resources?: unknown;
}

const resourceMatches = (pattern: string, filename: string): boolean =>
    new RegExp(
        "^" +
            pattern
                .replace(/^\//, "")
                .split("*")
                .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join(".*") +
            "$"
    ).test(filename);

const origins = (pattern: string): Array<{scheme: string; host: string}> => {
    if (pattern === "<all_urls>")
        return ["http", "https", "file", "ftp", "ws", "wss"].map(scheme => ({scheme, host: "*"}));
    const match = /^(\*|https?|file|ftp|wss?):\/\/([^/]*)(\/.*)$/.exec(pattern);
    if (!match) throw new Error(`Cannot verify resource access for match pattern "${pattern}"`);
    return (match[1] === "*" ? ["http", "https"] : [match[1]]).map(scheme => ({scheme, host: match[2].toLowerCase()}));
};

const coversHost = (allowed: string, requested: string): boolean => {
    if (allowed === "*" || allowed === requested) return true;
    if (!allowed.startsWith("*.")) return false;
    const suffix = allowed.slice(2);
    const host = requested.startsWith("*.") ? requested.slice(2) : requested;
    return host === suffix || host.endsWith("." + suffix);
};

/** Proves origin-set containment; checking sample URLs cannot prove wildcard coverage. */
export const validateResourceAccess = (
    requirements: Iterable<ResourceAccessPluginRequirement>,
    manifest: AccessManifest
): void => {
    const rules = Array.isArray(manifest.web_accessible_resources) ? manifest.web_accessible_resources : [];
    for (const {resource, matches, issuer, hint} of requirements) {
        const applicable =
            manifest.manifest_version === 2
                ? rules.filter(rule => typeof rule === "string" && resourceMatches(rule, resource))
                : rules.filter(
                      rule =>
                          Array.isArray(rule?.resources) &&
                          rule.resources.some((pattern: string) => resourceMatches(pattern, resource))
                  );
        const allowed =
            manifest.manifest_version === 2
                ? []
                : applicable.flatMap(rule => (rule.matches ?? []).flatMap((pattern: string) => origins(pattern)));
        const missing =
            manifest.manifest_version === 2
                ? applicable.length
                    ? []
                    : matches
                : matches.filter(
                      pattern =>
                          !origins(pattern).every(requested =>
                              allowed.some(
                                  origin =>
                                      origin.scheme === requested.scheme && coversHost(origin.host, requested.host)
                              )
                          )
                  );
        if (!applicable.length || missing.length) {
            throw new Error(
                `${issuer} cannot access resource "${resource}" for ${missing.join(", ") || "the requested matches"}; ${hint ?? "ensure web_accessible_resources covers the resource and requested matches"}`
            );
        }
    }
};
