import path from "path";
import {createRequire} from "module";
import _ from "lodash";

import {toPosix} from "@cli/utils/path";
import {getAppPath, getAppSourcePath, getSharedPath, getSourcePath} from "@cli/resolvers/path";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointFile, EntrypointFinder} from "@typing/entrypoint";

export default abstract class implements EntrypointFinder {
    protected _files?: Set<EntrypointFile>;

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

        const files = Array.from(await this.getFiles()).toSorted((a, b) => {
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
        const {dir, name} = path.parse(filename);

        const result = toPosix(name === "index" ? dir : path.join(dir, name));

        return {file: filename, import: result};
    }

    protected resolve(name: string, filename: string): EntrypointFile {
        const spec = path.posix.join(name, filename);

        const require = createRequire(import.meta.url);

        const file = require.resolve(spec, {paths: [process.cwd()]});

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
