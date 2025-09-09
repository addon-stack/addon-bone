import path from "path";
import {createRequire} from "module";

import TsResolver from "./TsResolver";

import {hasEntrypointPath, resolveEntrypointPath} from "@cli/entrypoint";

import {PackageName} from "@typing/app";

export default class {
    protected baseDir: string;

    constructor(protected ts: TsResolver = TsResolver.make()) {
        this.baseDir = process.cwd();
    }

    public setTs(ts: TsResolver): this {
        this.ts = ts;

        return this;
    }

    public setBaseDir(baseDir: string): this {
        this.baseDir = baseDir;

        return this;
    }

    public get(importPath: string): string {
        if (importPath.startsWith(".") || importPath.startsWith("/")) {
            let resolvedLocal: string | undefined = path.resolve(this.baseDir, importPath);

            if (hasEntrypointPath(resolvedLocal)) {
                return resolvedLocal;
            }

            resolvedLocal = resolveEntrypointPath(resolvedLocal);

            if (resolvedLocal) {
                return resolvedLocal;
            }

            return importPath;
        }

        let aliased = this.ts.matchPath(importPath);

        if (aliased) {
            if (hasEntrypointPath(aliased)) {
                return path.resolve(aliased);
            }

            aliased = resolveEntrypointPath(aliased);

            if (aliased) {
                return path.resolve(aliased);
            }
        }

        try {
            if (importPath === PackageName || importPath.startsWith(`${PackageName}/`)) {
                return importPath;
            }

            return createRequire(import.meta.url).resolve(importPath, {paths: [this.baseDir]});
        } catch {
            return importPath;
        }
    }
}
