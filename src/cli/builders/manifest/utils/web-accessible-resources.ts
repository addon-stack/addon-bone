import {ManifestAccessibleResource} from "@typing/manifest";

import {filterHostPatterns} from "./host-patterns";

export const mergeWebAccessibleResources = (resources: ManifestAccessibleResource[]): ManifestAccessibleResource[] => {
    if (resources.length === 0) return [];

    const normalize = (arr?: string[]) => Array.from(new Set(arr || [])).sort();

    const normalizeRule = (r: ManifestAccessibleResource): ManifestAccessibleResource => ({
        resources: normalize(r.resources),
        // WAR matches use origins only; Chrome requires the path to be exactly /*.
        matches: normalize(
            Array.from(
                filterHostPatterns(new Set(r.matches?.map(match => match.replace(/^([^:]+:\/\/[^/]*)(\/.*)$/, "$1/*"))))
            )
        ),
        // Chrome requires the all-extensions wildcard to be the only ID in the array.
        extensionIds: r.extensionIds?.includes("*") ? ["*"] : normalize(r.extensionIds),
        useDynamicUrl: r.useDynamicUrl,
    });

    const makeKey = (r: ManifestAccessibleResource, exclude: keyof ManifestAccessibleResource): string => {
        const obj: Partial<ManifestAccessibleResource> = {...r, useDynamicUrl: r.useDynamicUrl ?? false};
        delete obj[exclude];

        return JSON.stringify(obj);
    };

    const mergeTwo = (a: ManifestAccessibleResource, b: ManifestAccessibleResource): ManifestAccessibleResource =>
        normalizeRule({
            resources: [...a.resources, ...b.resources],
            matches: [...(a.matches || []), ...(b.matches || [])],
            extensionIds: [...(a.extensionIds || []), ...(b.extensionIds || [])],
            useDynamicUrl: a.useDynamicUrl ?? b.useDynamicUrl,
        });

    const coversAudience = (covering: ManifestAccessibleResource, candidate: ManifestAccessibleResource): boolean => {
        if ((covering.useDynamicUrl ?? false) !== (candidate.useDynamicUrl ?? false)) return false;

        const matches = covering.matches || [];
        const extensionIds = covering.extensionIds || [];

        return (
            (candidate.matches || []).every(
                match => matches.includes(match) || !filterHostPatterns(new Set([...matches, match])).has(match)
            ) && (candidate.extensionIds || []).every(id => extensionIds.includes("*") || extensionIds.includes(id))
        );
    };

    const merge = (resources: ManifestAccessibleResource[], mergeBy: keyof ManifestAccessibleResource) => {
        const map = new Map<string, ManifestAccessibleResource>();
        let changed = false;
        for (const r of resources) {
            const key = makeKey(r, mergeBy);
            if (map.has(key)) {
                const merged = mergeTwo(map.get(key)!, r);
                map.set(key, merged);
                changed = true;
            } else {
                map.set(key, r);
            }
        }

        return {
            changed,
            result: Array.from(map.values()),
        };
    };

    let changed = true;

    let result = resources.map(normalizeRule).filter(r => r.resources.length > 0);

    while (changed) {
        changed = false;

        const mergeByResources = merge(result, "resources");
        const afterResources = mergeByResources.result;

        const mergeByMatches = merge(afterResources, "matches");
        const afterMatches = mergeByMatches.result;

        const mergeByExtensionIds = merge(afterMatches, "extensionIds");
        const afterExtensionIds = mergeByExtensionIds.result;

        changed = mergeByResources.changed || mergeByMatches.changed || mergeByExtensionIds.changed;
        result = afterExtensionIds;

        // A duplicate is removable only if every origin and extension ID remains covered.
        // Mutate the normalized copies in order so equivalent rules cannot remove each other.
        for (const entry of result) {
            for (const other of result) {
                if (other === entry || !coversAudience(entry, other)) continue;

                const remaining = other.resources.filter(resource => !entry.resources.includes(resource));
                if (remaining.length < other.resources.length) {
                    other.resources = remaining;
                    changed = true;
                }
            }
        }

        result = result.filter(r => r.resources.length > 0);
    }

    return result.map(r => {
        if (r.matches?.length === 0) delete r.matches;
        if (r.extensionIds?.length === 0) delete r.extensionIds;
        if (r.useDynamicUrl === undefined) delete r.useDynamicUrl;
        return r;
    });
};
