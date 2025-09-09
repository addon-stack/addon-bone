import _ from "lodash";
import path from "path";
import fs from "fs";
import {createRequire} from "module";
import {fileURLToPath} from "url";

import {toPosixPath} from "@cli/utils/path";
import {isFile} from "@cli/utils/fs";
import {
    getAppPath,
    getAppSourcePath,
    getResolvePath,
    getSharedPath,
    getSourcePath,
    resolveRootPath,
} from "@cli/resolvers/path";
import {resolveAssetsPath, resolveEntrypointPath} from "@cli/entrypoint/utils";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointFile, EntrypointFinder} from "@typing/entrypoint";

export default abstract class implements EntrypointFinder {
    protected _files?: Set<EntrypointFile>;

    private readonly require = createRequire(import.meta.url);

    protected readonly priorityDirectories: string[];

    protected abstract getFiles(): Promise<Set<EntrypointFile>>;

    protected constructor(protected readonly config: ReadonlyConfig) {
        this.priorityDirectories = [
            "node_modules",
            getSourcePath(config),
            getSharedPath(config),
            getAppPath(config),
            getAppSourcePath(config),
        ];
    }

    public clear(): this {
        this._files = undefined;

        return this;
    }

    public async files(): Promise<Set<EntrypointFile>> {
        if (this._files) {
            return this._files;
        }

        const files = Array.from(await this.getFiles()).sort((a, b) => {
            const priorityA = this.priority(a);
            const priorityB = this.priority(b);

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            return a.file.length - b.file.length;
        });

        return (this._files = new Set(files));
    }

    public async empty(): Promise<boolean> {
        return (await this.files()).size === 0;
    }

    public async exists(): Promise<boolean> {
        return !(await this.empty());
    }

    public holds(file: EntrypointFile): boolean {
        return this._files?.has(file) || false;
    }

    protected file(filename: string): EntrypointFile {
        return {file: filename, import: toPosixPath(filename)};
    }

    protected resolve(name: string, filename: string): EntrypointFile {
        let base: string = name.startsWith("file://") ? fileURLToPath(name) : name;

        if (path.isAbsolute(base)) {
            if (isFile(base)) {
                base = path.dirname(base);
            }

            const absBase = path.join(base, filename);

            let resolved: string | undefined = isFile(absBase)
                ? absBase
                : (resolveEntrypointPath(absBase) ?? resolveAssetsPath(absBase));

            if (!resolved) {
                throw new Error(`Cannot resolve entrypoint file "${filename}" from "${name}"`);
            }

            resolved = fs.realpathSync.native(resolved);

            const srcDir = getResolvePath(getSourcePath(this.config));

            return {
                file: resolved,
                /**
                 * Global alias "@/":
                 * baked into the framework by the TypeScript plugin
                 * (src/cli/plugins/typescript) and points to the sources directory (srcDir).
                 * Here we build a relative path from srcDir so that the import looks like "@/relative/path".
                 * @type {string}
                 */
                import: "@/" + toPosixPath(path.relative(srcDir, resolved)),
            };
        }

        const spec: string = path.posix.join(name, filename);

        const file = this.require.resolve(spec, {paths: [resolveRootPath(this.config)]});

        return {
            file,
            import: spec,
            external: name,
        };
    }

    protected resolveSafely(name: string, filename: string): EntrypointFile | undefined {
        try {
            return this.resolve(name, filename);
        } catch {
            return undefined;
        }
    }

    protected priority(file: EntrypointFile): number {
        return _.findIndex(this.priorityDirectories, dir => file.file.includes(dir));
    }
}
