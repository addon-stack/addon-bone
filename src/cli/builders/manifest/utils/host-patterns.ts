import _ from "lodash";
import {ManifestMatchSchemes} from "@typing/manifest";

interface HostPattern {
    scheme: string;
    host: string;
    path: string;
    pathMatcher: RegExp;
}

const parseHostPattern = (pattern: string): HostPattern | undefined => {
    const match = pattern.match(/^([^:]+):\/\/([^/]*)(\/.*)$/);
    if (!match) return;

    const [, scheme, host, path] = match;
    if (scheme !== "*" && !ManifestMatchSchemes.has(scheme)) return;

    return {
        scheme,
        host,
        path,
        pathMatcher: new RegExp(`^${path.split("*").map(_.escapeRegExp).join(".*")}$`),
    };
};

const isHostPatternCovered = (pattern?: HostPattern, covering?: HostPattern): boolean => {
    if (!pattern || !covering) return false;

    const schemeCovered =
        covering.scheme === pattern.scheme ||
        (covering.scheme === "*" && (pattern.scheme === "http" || pattern.scheme === "https"));
    if (!schemeCovered) return false;

    const hostCovered =
        covering.host === "*" ||
        covering.host === pattern.host ||
        (covering.host.startsWith("*.") &&
            (pattern.host === covering.host.slice(2) || pattern.host.endsWith(covering.host.slice(1))));
    if (!hostCovered) return false;

    // Keep path constraints: this utility also filters web-accessible resource matches.
    // Any '*' in the candidate must be consumed by a wildcard in the covering path.
    return covering.pathMatcher.test(pattern.path);
};

export const filterHostPatterns = (patterns: Set<string>): Set<string> => {
    if (patterns.has("<all_urls>")) {
        return new Set(["<all_urls>"]);
    }

    const entries = Array.from(patterns, pattern => ({pattern, parsed: parseHostPattern(pattern)}));

    return new Set(
        entries
            .filter(
                (entry, index) =>
                    !entries.some(
                        (other, otherIndex) =>
                            index !== otherIndex &&
                            isHostPatternCovered(entry.parsed, other.parsed) &&
                            // Equivalent patterns keep their first occurrence instead of removing each other.
                            (otherIndex < index || !isHostPatternCovered(other.parsed, entry.parsed))
                    )
            )
            .map(({pattern}) => pattern)
    );
};
