import path from "path";
import {NormalModule, type OptimizationSplitChunksCacheGroupTestFn} from "@rspack/core";

import {PackageName} from "@typing/app";

const getEntryDirs = (entry: string | string[]): string[] => {
    const entries = Array.isArray(entry) ? entry : [entry];

    if (entries.length === 0) {
        return [];
    }

    return entries.flatMap(v => [
        path.join("node_modules", PackageName, "dist", "entry", v),
        path.join("addonbone", "dist", "entry", v), // TODO: Only for test. Remove this
        path.join("addon-bone", "dist", "entry", v), // TODO: Only for test. Remove this
    ]);
};

export const onlyViaTopLevelEntry = (entry: string | string[]): OptimizationSplitChunksCacheGroupTestFn => {
    const entryDirs = getEntryDirs(entry);

    if (entryDirs.length === 0) {
        return () => false;
    }

    const isTargetRes = (res?: string) => !!res && entryDirs.some(dir => res!.includes(dir));

    const memoTopLevelTarget = new WeakMap<object, boolean>();
    const memoPathOk = new WeakMap<object, boolean>();

    const isTopLevelTarget = (m: NormalModule | undefined, mg: any): boolean => {
        if (!m) {
            return false;
        }

        const cached = memoTopLevelTarget.get(m);

        if (cached !== undefined) {
            return cached;
        }

        const ok =
            isTargetRes(m.resource) &&
            (() => {
                const issuer = mg.getIssuer(m) as NormalModule | undefined;
                return !!issuer && !mg.getIssuer(issuer);
            })();

        memoTopLevelTarget.set(m, ok);

        return ok;
    };

    const pathHasTopLevelTarget = (start: NormalModule | undefined, mg: any): boolean => {
        if (!start) {
            return false;
        }

        const cached = memoPathOk.get(start);

        if (cached !== undefined) {
            return cached;
        }

        let cur: NormalModule | undefined = start;
        let steps = 0;

        const MAX_STEPS = 1024;

        while (cur && steps++ < MAX_STEPS) {
            if (isTopLevelTarget(cur, mg)) {
                memoPathOk.set(start, true);
                return true;
            }

            cur = mg.getIssuer(cur) as NormalModule | undefined;
        }

        memoPathOk.set(start, false);

        return false;
    };

    return (module, {moduleGraph}) => {
        const nm = module as NormalModule;
        const res = nm.resource;

        if (!res) {
            return false;
        }

        if (isTargetRes(res)) return true;

        const conns = moduleGraph.getIncomingConnections(nm);

        if (!conns || conns.length === 0) {
            return false;
        }

        for (let i = 0; i < conns.length; i++) {
            const origin = conns[i].originModule as NormalModule | undefined;

            if (!pathHasTopLevelTarget(origin, moduleGraph)) {
                return false;
            }
        }

        return true;
    };
};

export const isEntryModuleOrIssuer = (entry: string | string[]): OptimizationSplitChunksCacheGroupTestFn => {
    const entryDirs = getEntryDirs(entry);

    if (entryDirs.length === 0) {
        return () => false;
    }

    return (module, {moduleGraph}) => {
        const nm = module as NormalModule;
        const resource = nm.resource || "";

        if (entryDirs.some(dir => resource.includes(dir))) {
            return true;
        }

        for (const connection of moduleGraph.getIncomingConnections(nm)) {
            const origin = connection.originModule as NormalModule | undefined;

            if (!origin?.resource) {
                continue;
            }

            const originRes = origin.resource;

            if (entryDirs.some(dir => originRes.includes(dir))) {
                return true;
            }
        }

        return false;
    };
};
